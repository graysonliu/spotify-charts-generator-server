certbot renew --standalone

# renew ignoring whether it will be due in 30 days
# certbot renew --standalone --force-renewal

# renew monthly using cron
# crontab -e
# 0 0 1 * * /root/ws/spotify-charts-generator-server/ssl_renew.sh
