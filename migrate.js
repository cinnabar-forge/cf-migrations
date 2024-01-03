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
  migrations.push({
    queries: [
      `INSERT INTO migrations (revision, app_version, date_migrated) VALUES (?, ?, ?);`,
    ],
    args: [
      migrations.length,
      process.env.npm_package_version,
      Math.round(Date.now() / 1000),
    ],
  });
}

function addSql(query, args) {
  const currentMigration = migrations[migrations.length - 1];
  currentMigration.queries.push(query);
  if (args) {
    currentMigration.args.push(...args);
  }
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
  const currentMigration = migrations[migrations.length - 1];

  tables[name] = {};

  for (const [columnName, column] of Object.entries(columns)) {
    if (column.id) {
      column.type = "integer";
      column.primaryKey = true;
      column.autoIncrement = true;
    }

    tables[name][columnName] = { type: column.type };
  }

  currentMigration.queries.push(getTableCreationSqlQuery(name, columns));
}

function addTableColumn(tableName, columnName, column) {
  const currentMigration = migrations[migrations.length - 1];
  const currentColumn = tables[tableName][columnName];

  let query = `ALTER TABLE "${tableName}" ADD COLUMN ${getColumnQueryPart(
    columnName,
    column
  )};`;
  currentMigration.queries.push(query);
}

function renameTableColumn(tableName, columnName, newColumnName) {
  const currentMigration = migrations[migrations.length - 1];

  const query = `ALTER TABLE "${tableName}" RENAME COLUMN "${columnName}" TO "${newColumnName}";`;
  currentMigration.queries.push(query);
}

function changeTableColumn(tableName, columnName, column) {
  const currentMigration = migrations[migrations.length - 1];
  const tempTableName = tableName + "_tmp";
  const queries = [];

  tables[tableName][columnName] = column;

  queries.push(getTableCreationSqlQuery(tempTableName, tables[tableName]));

  const recreatedColumns = Object.keys(tables[tableName]).join(", ");

  queries.push(
    `INSERT INTO ${tempTableName} (${recreatedColumns}) SELECT ${recreatedColumns} FROM ${tableName};`
  );

  queries.push(`DROP TABLE "${tableName}";`);
  queries.push(`ALTER TABLE "${tempTableName}" RENAME TO "${tableName}";`);

  currentMigration.queries.push(queries.join("\n"));
}

function getMigrationRevisionSqlQuery() {
  return "CREATE TABLE IF NOT EXISTS migrations (revision INTEGER NOT NULL PRIMARY KEY, app_version TEXT NOT NULL, date_migrated INTEGER NOT NULL); SELECT MAX(revision) as latest_revision, app_version, date_migrated FROM migrations;";
}

function getMigrationsSqlBundle(latestMigration) {
  const queries = [];
  const args = [];

  queries.push("BEGIN TRANSACTION;");

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
    console.log(`New database`);
  }

  if (latestMigration.latest_revision < migrations.length) {
    console.log(`Migrating to revision ${migrations.length - 1}...`);
    for (
      let revision = latestMigration.latest_revision;
      revision < migrations.length;
      revision++
    ) {
      if (revision > 0) {
        console.log(`...migration from r${revision - 1} to r${revision}...`);
      }

      queries.push(...migrations[revision].queries);
      args.push(...migrations[revision].args);
    }
    console.log("...done migrating");
  } else {
    console.log(`Database is up-to-date`);
  }

  queries.push("COMMIT TRANSACTION;");
  queries.push("VACUUM;");

  return { query: queries.join("\n"), args };
}

export default {
  resetContext,
  getSqlDialect,
  setSqlDialect,
  createMigration,
  addSql,
  createTable,
  addTableColumn,
  renameTableColumn,
  changeTableColumn,
  getMigrationRevisionSqlQuery,
  getMigrationsSqlBundle,
};
