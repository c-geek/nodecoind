#!/bin/bash

### Releasing
current=`grep -P "version\": \"\d+.\d+.\d+(\w*)" package.json | grep -oP "\d+.\d+.\d+(\w*)"`
echo "Current version: $current"

if [[ $1 =~ ^[0-9]+.[0-9]+.[0-9]+((a|b)[0-9]+)?$ ]]; then
  echo "Changing to version: $1"
  # Change the version in package.json and test file
  sed -i "s/version\": .*/version\": \"$1\",/g" package.json
  sed -i "s/Version: .*/Version: $1/g" release/extra/debian/package/DEBIAN/control
  sed -i "s/ release: .*/ release: v$1/g" appveyor.yml

  # Duniter.iss (Windows installer)
  sed -i "s/define MyAppVerStr.*/define MyAppVerStr \"v$1\"/g" release/arch/windows/duniter.iss

  # GUI containers version
  sed -i "s/title\": .*/title\": \"v$1\",/g" package.json
  sed -i "s/<title>Duniter.*<\/title>/<title>Duniter $1<\/title>/g" gui/index.html

  # Commit
  git reset HEAD
  git add package.json gui/index.html release/extra/debian/package/DEBIAN/control release/arch/windows/duniter.iss
  git commit -m "v$1"
  git tag "v$1"
else
  echo "Wrong version format"
fi
