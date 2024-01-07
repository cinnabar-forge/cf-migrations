let dialect;

const migrations = [];

const tables = {};

function resetContext() {
  migrations.length = 0;
  const props = Object.getOwnPropertyNames(tables);
  for (let i = 0; i < props.length; i++) {
    delete tables[props[i]];
  }
}

function getSqlDialect() {
  return dialect;
}

function setSqlDialect(value) {
  dialect = value;
}

function createMigration() {
  migrations.push([
    {
      query: `INSERT INTO "migrations" (revision, app_version, date_migrated) VALUES (?, ?, ?);`,
      args: [
        migrations.length,
        process.env.npm_package_version,
        Math.round(Date.now() / 1000),
      ],
    },
  ]);
}

function addSql(query, args) {
  const currentMigration = migrations[migrations.length - 1];
  currentMigration.push({ query, args });
}

function getColumnQueryPart(columnName, column) {
  const columnQuery = [];
  columnQuery.push(`"${columnName}"`);
  columnQuery.push(column.type.toUpperCase());
  if (column.primaryKey) {
    columnQuery.push("PRIMARY KEY");
  }
  if (column.autoIncrement) {
    columnQuery.push("AUTOINCREMENT");
  }
  if (column.notNull) {
    columnQuery.push("NOT NULL");
  }

  return columnQuery.join(" ");
}

function getTableCreationSqlQuery(name, columns) {
  const columnsQuery = [];

  const primaryKeys = [];
  const uniques = [];

  for (const [columnName, column] of Object.entries(columns)) {
    if (!column.id && column.primaryKey) {
      primaryKeys.push(`"${columnName}"`);
    }

    if (column.unique) {
      uniques.push(`"${columnName}"`);
    }

    columnsQuery.push(getColumnQueryPart(columnName, column));
  }

  if (primaryKeys.length > 0) {
    columnsQuery.push(`PRIMARY KEY(${primaryKeys.join(", ")})`);
  }

  if (uniques.length > 0) {
    columnsQuery.push(`UNIQUE(${uniques.join(", ")})`);
  }

  return `CREATE TABLE "${name}" (${columnsQuery.join(", ")});`;
}

function createTable(name, columns) {
  tables[name] = {};

  for (const [columnName, column] of Object.entries(columns)) {
    if (column.id) {
      column.type = "integer";
      column.primaryKey = true;
      column.autoIncrement = true;
    }

    tables[name][columnName] = { type: column.type };
  }

  addSql(getTableCreationSqlQuery(name, columns));
}

function addTableColumn(tableName, columnName, column) {
  const query = `ALTER TABLE "${tableName}" ADD COLUMN ${getColumnQueryPart(
    columnName,
    column
  )};`;
  addSql(query);
}

function renameTableColumn(tableName, columnName, newColumnName) {
  const query = `ALTER TABLE "${tableName}" RENAME COLUMN "${columnName}" TO "${newColumnName}";`;
  addSql(query);
}

function changeTableColumn(tableName, columnName, column) {
  const currentMigration = migrations[migrations.length - 1];
  const tempTableName = tableName + "_tmp";

  tables[tableName][columnName] = column;

  addSql(getTableCreationSqlQuery(tempTableName, tables[tableName]));

  const recreatedColumns = Object.keys(tables[tableName]).join(", ");

  addSql(
    `INSERT INTO ${tempTableName} (${recreatedColumns}) SELECT ${recreatedColumns} FROM ${tableName};`
  );

  addSql(`DROP TABLE "${tableName}";`);
  addSql(`ALTER TABLE "${tempTableName}" RENAME TO "${tableName}";`);
}

function getMigrationTableSqlCreateQuery() {
  return `CREATE TABLE IF NOT EXISTS "migrations" ("revision" INTEGER NOT NULL PRIMARY KEY, "app_version" TEXT NOT NULL, "date_migrated" INTEGER NOT NULL);`;
}

function getMigrationRevisionSqlSelectQuery() {
  return `SELECT MAX(revision) as "latest_revision", "app_version", "date_migrated" FROM "migrations";`;
}

function getMigrationsSqlQueries(latestMigration) {
  const queries = [];

  queries.push({ query: "BEGIN TRANSACTION;" });

  console.log(`Generating migration SQL queries...`);

  if (latestMigration.latest_revision != null) {
    console.log(
      `Last database migration: ${new Date(
        latestMigration.date_migrated * 1000
      ).toISOString()} (r${latestMigration.latest_revision}, v${
        latestMigration.app_version
      })`
    );
  } else {
    latestMigration.latest_revision = 0;
    console.log(`Migration history is empty`);
  }

  if (latestMigration.latest_revision < migrations.length) {
    console.log(`Target migration: ${migrations.length - 1}`);
    for (
      let revision = latestMigration.latest_revision;
      revision < migrations.length;
      revision++
    ) {
      queries.push(...migrations[revision]);
    }
  }

  queries.push({ query: "COMMIT TRANSACTION;" });
  queries.push({ query: "VACUUM;" });

  console.log(`...SQL queries have been generated`);

  return queries;
}

export default function () {
  return {
    resetContext,
    getSqlDialect,
    setSqlDialect,
    createMigration,
    addSql,
    createTable,
    addTableColumn,
    renameTableColumn,
    changeTableColumn,
    getMigrationTableSqlCreateQuery,
    getMigrationRevisionSqlSelectQuery,
    getMigrationsSqlQueries,
  };
}
