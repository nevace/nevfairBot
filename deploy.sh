#!/bin/bash

#echo "Getting latest code"
#echo ""
#cd "nevfairBot"
#git pull

#mkdir -p /home/nevace/.ssh && \ ssh-keyscan -t rsa 139.59.178.69 > ~/.ssh/known_hosts && \ echo $PRIVATE_SSH_KEY >> /home/nevace/.ssh/id_rsa && \ chmod -R 700 /home/nevace/.ssh && \ cat /home/nevace/.ssh/id_rsa && \ ssh nevace@139.59.178.69 touch hi4.txt

mkdir -p /home/nevace/.ssh
ssh-keyscan -t rsa 139.59.178.69 > ~/.ssh/known_hosts
echo $PRIVATE_SSH_KEY >> /home/nevace/.ssh/id_rsa
chmod -R 700 /home/nevace/.ssh
cat /home/nevace/.ssh/id_rsa
ssh nevace@139.59.178.69 touch hi4.txt