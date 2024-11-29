#!/bin/bash

# load secrets
source .env.local

user="$WP_USER"
password=$WP_PASSWORD

curl="/usr/bin/curl"      # path to curl
path="./tmp"              # path to temporary cookie files

agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
site="https://etheriamagazine.com"

# create tmp path
mkdir -p "$path"

## clean 
rm -rf "$path"/*

## download ##


## authenticate and save cookies

"$curl" -s -o /dev/null \
        --user-agent "$agent" \
        --dump-header  "$path"/headers.txt \
        --cookie-jar "$path"/cookies.txt \
        --form log="$user" \
        --form pwd="$password" \
        --form testcookie=1 \
        --form wp-submit="Log In" \
        --form redirect_to="$site"/wp-admin \
        --form submit=login \
        --form rememberme=forever \
        "$site"/adminmagazine/


"$curl" -o export.xml \
        --user-agent "$agent" \
        --referer https://etheriamagazine.com/wp-admin/export.php \
        --cookie "$path"/cookies.txt \
        "${site}/wp-admin/export.php?download=true"

echo "done!"