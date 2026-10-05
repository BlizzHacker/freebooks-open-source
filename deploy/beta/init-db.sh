#!/bin/sh
set -eu
# Scope tenant provisioning to this installation's namespace.
mariadb --protocol=socket -uroot -p"$MARIADB_ROOT_PASSWORD" <<SQL
GRANT ALL PRIVILEGES ON \`freebooks\\_tenant\\_%\`.* TO '$MARIADB_USER'@'%';
FLUSH PRIVILEGES;
SQL
