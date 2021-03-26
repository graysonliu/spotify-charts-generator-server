set -a # export environment variables for subprocess
source ./env/local.env
set +a # disable
exec > run.log # redirect output
cd redis && redis-server ./redis.conf &

# remove if the directory already exists 
rm -rf ./app/certificates
# create a soft link directory to SSL certificates
ln -s /etc/letsencrypt/live/spotify.zijian.xyz ./app/certificates
cd app && npm install && npx nodemon app.js