# stop
./stop-docker-compose.sh
# run containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --no-build
