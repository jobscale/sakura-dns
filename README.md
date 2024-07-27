## sakura-dns dynamic DNS

## run with container
```
git clone https://github.com/jobscale/sakura-dns.git
cd sakura-dns
```

## setup and test
```bash
echo "module.exports = {
  domain: 'example.com',
  token: 'secret',
  hosts: ['@', '*'],
};" > app/.env.js
npm i
npm run lint --if-present
npm start
```

## build and run
```
main() {
  docker build . -t local/sakura-dns
  docker run --rm -it local/sakura-dns
} && main
```

### create cronjob
```
kubectl create cronjob sakura-dns --image local/sakura-dns --schedule '0/7 * * * *'
kubectl create job --from=cronjob/sakura-dns sakura-dns-manual-$(date +'%Y%m%d-%H%M')
```
