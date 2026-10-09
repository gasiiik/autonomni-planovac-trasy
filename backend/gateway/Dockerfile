FROM php:8.2-apache

# Instalace rozšíření pro MariaDB (MySQL PDO)
RUN docker-php-ext-install pdo pdo_mysql

# Povolení mod_rewrite pro Apache (užitečné pro čisté URL u REST API)
RUN a2enmod rewrite

# Nastavení pracovní složky
WORKDIR /var/www/html
