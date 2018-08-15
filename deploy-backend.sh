#!/bin/bash
echo "Stopping workers..."
sudo supervisorctl stop all
git pull
composer install --no-dev
./artisan migrate
echo "Starting workers..."
./artisan cache:clear
./artisan view:clear
sudo supervisorctl start all
./artisan queue:restart
tail -f storage/logs/*.log
