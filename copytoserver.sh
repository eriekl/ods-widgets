#!/usr/bin/env bash

rsync -avz -e "ssh -i .travis.deploy -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" --delete -P ./docs/ "$DEPLOY_USER"@"$DEPLOY_IP":"$1"
