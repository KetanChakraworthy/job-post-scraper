echo "Running jobs.sh \n"
git switch main; 
echo "Pulling main...\n"
git pull origin main;
echo "Running Jobs Scraper...\n"
npm run crawlee_jobs
