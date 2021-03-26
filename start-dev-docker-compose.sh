set -a # export environment variables for subprocess
source ./env/dev-docker-compose.env
set +a # disable

# redirect output
exec > run.log
# run containers
docker-compose up --no-color