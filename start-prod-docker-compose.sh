# remove if the directory already exists 
rm -rf ./app/certificates
rm -rf ./app/node_modules

# run containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
