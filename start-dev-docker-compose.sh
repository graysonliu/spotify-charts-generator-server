# remove if the directory already exists 
rm -rf ./app/certificates
rm -rf ./app/node_modules

# redirect output
# exec > run.log
# run containers
docker-compose up --no-color > run.log &