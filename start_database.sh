#!/bin/bash

docker run --rm -p 5432:5432 --name postgres \
-e POSTGRES_HOST_AUTH_METHOD=trust \
-e POSTGRES_USER=postgres \
-e POSTGRES_DB=postgres \
postgres