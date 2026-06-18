#!/bin/bash

# ==============================================================================
# Script de Despliegue Automatizado para GCP Always Free (e2-micro)
# Sistema Operativo Recomendado: Ubuntu 22.04 LTS o Ubuntu 24.04 LTS
# ==============================================================================

# Colores para salida de consola
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0;34m' # No Color (restaurar)
NC_RESET='\033[0m'

echo -e "${BLUE}======================================================${NC_RESET}"
echo -e "${GREEN}  Iniciando aprovisionamiento del servidor web en GCP  ${NC_RESET}"
echo -e "${BLUE}======================================================${NC_RESET}"

# Verificar si se ejecuta como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Por favor, ejecuta este script como root (usando sudo).${NC_RESET}"
  exit 1
fi

# Leer el subdominio de DuckDNS
echo -e "${YELLOW}Por favor, introduce tu subdominio de DuckDNS (ej: miwebgcp.duckdns.org):${NC_RESET}"
read -r DOMAIN

if [ -z "$DOMAIN" ]; then
  echo -e "${RED}Error: El nombre de dominio no puede estar vacío.${NC_RESET}"
  exit 1
fi

# Leer el Token de DuckDNS
echo -e "${YELLOW}Introduce tu TOKEN de DuckDNS (para automatizar la actualización de IP):${NC_RESET}"
read -r DUCK_TOKEN

# 1. Actualizar el sistema
echo -e "\n${BLUE}[1/7] Actualizando los paquetes del sistema...${NC_RESET}"
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git build-essential ufw cron

# 2. Instalar Node.js LTS (v20)
echo -e "\n${BLUE}[2/7] Instalando Node.js v20 (LTS)...${NC_RESET}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo -e "${GREEN}Node.js versión: $(node -v)${NC_RESET}"
echo -e "${GREEN}npm versión: $(npm -v)${NC_RESET}"

# 3. Instalar PM2 para mantener la app en ejecución
echo -e "\n${BLUE}[3/7] Instalando PM2 (Process Manager) de forma global...${NC_RESET}"
npm install pm2 -g

# 4. Configurar la aplicación en /var/www/gcp-app
echo -e "\n${BLUE}[4/7] Configurando el directorio de la aplicación...${NC_RESET}"
APP_DIR="/var/www/gcp-app"
mkdir -p "$APP_DIR"

# Copiar archivos del directorio actual al directorio de despliegue si existen,
# sino, clonar (esto es útil tanto si el script se corre localmente como remotamente)
if [ -f "./package.json" ]; then
  cp -r ./* "$APP_DIR/"
  # Asegurar que no copiamos el propio deploy.sh recursivamente o database.db local si existe
  rm -f "$APP_DIR/database.db"
else
  echo -e "${YELLOW}No se encontraron archivos en el directorio actual. Por favor, clona tu repositorio en $APP_DIR antes de continuar.${NC_RESET}"
fi

cd "$APP_DIR" || exit
npm install --omit=dev
chown -R www-data:www-data "$APP_DIR"

# Iniciar la aplicación con PM2
echo -e "${BLUE}Iniciando aplicación Express con PM2...${NC_RESET}"
pm2 start server.js --name "gcp-web" --update-env
pm2 startup systemd
# Generar el comando de startup para que persista tras reinicios
env PATH=$PATH:/usr/bin pm2 startup systemd -u www-data --hp /home/www-data
pm2 save

# 5. Instalar y configurar Nginx como Proxy Inverso
echo -e "\n${BLUE}[5/7] Instalando y configurando Nginx...${NC_RESET}"
apt-get install -y nginx

# Crear la configuración del servidor en Nginx
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
echo "Creando configuración de Nginx en $NGINX_CONF..."

cat <<EOT > "$NGINX_CONF"
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOT

# Activar la configuración y reiniciar Nginx
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 6. Configurar la actualización dinámica de IP en DuckDNS
if [ -n "$DUCK_TOKEN" ]; then
  echo -e "\n${BLUE}[6/7] Configurando script de actualización automática de DuckDNS...${NC_RESET}"
  # Extraer sólo la parte del subdominio (sin .duckdns.org si el usuario lo metió completo)
  SUBDOMAIN=$(echo "$DOMAIN" | sed 's/\.duckdns\.org//')
  
  mkdir -p /root/duckdns
  DUCK_SCRIPT="/root/duckdns/duck.sh"
  
  echo "#!/bin/sh" > "$DUCK_SCRIPT"
  echo "echo url=\"https://www.duckdns.org/update?domains=$SUBDOMAIN&token=$DUCK_TOKEN&ip=\" | curl -k -o /root/duckdns/duck.log -K -" >> "$DUCK_SCRIPT"
  
  chmod 700 "$DUCK_SCRIPT"
  
  # Ejecutarlo una vez para actualizar la IP ahora mismo
  sh "$DUCK_SCRIPT"
  
  # Añadir tarea cron para actualizar cada 5 minutos
  (crontab -l 2>/dev/null; echo "*/5 * * * * $DUCK_SCRIPT >/dev/null 2>&1") | crontab -
  echo -e "${GREEN}Actualización de DuckDNS configurada correctamente (Cronjob cada 5 min).${NC_RESET}"
else
  echo -e "\n${YELLOW}[6/7] Saltando configuración de DuckDNS (no se proporcionó Token).${NC_RESET}"
fi

# 7. Configuración de HTTPS con Certbot (Let's Encrypt)
echo -e "\n${BLUE}[7/7] ¿Deseas instalar Certbot y configurar SSL (HTTPS) ahora? (s/n)${NC_RESET}"
read -r INSTALL_SSL

if [ "$INSTALL_SSL" = "s" ] || [ "$INSTALL_SSL" = "S" ]; then
  echo -e "${BLUE}Instalando Certbot para Nginx...${NC_RESET}"
  apt-get install -y certbot python3-certbot-nginx
  
  echo -e "${YELLOW}Ejecutando Certbot. Introduce tu correo cuando se solicite y acepta los términos:${NC_RESET}"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
  
  # Reiniciar Nginx para aplicar cambios SSL
  systemctl restart nginx
  echo -e "${GREEN}SSL configurado correctamente para $DOMAIN.${NC_RESET}"
else
  echo -e "${YELLOW}Configuración de SSL omitida. Tu web estará disponible por HTTP en el puerto 80.${NC_RESET}"
fi

# Configurar cortafuegos básico (UFW)
echo -e "\n${BLUE}Configurando cortafuegos (UFW)...${NC_RESET}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
# Activar firewall de forma no interactiva
echo "y" | ufw enable

echo -e "\n${GREEN}======================================================${NC_RESET}"
echo -e "${GREEN}  ¡Despliegue finalizado con éxito!                    ${NC_RESET}"
echo -e "${GREEN}  Tu web ya está escuchando peticiones en: http://$DOMAIN${NC_RESET}"
if [ "$INSTALL_SSL" = "s" ] || [ "$INSTALL_SSL" = "S" ]; then
  echo -e "${GREEN}  Acceso HTTPS seguro habilitado en: https://$DOMAIN${NC_RESET}"
fi
echo -e "${BLUE}======================================================${NC_RESET}"
