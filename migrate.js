let dialect;

let versionColumnName;

const EMPTY_OBJECT = {};

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
      query: `INSERT INTO "migrations" ("revision", "${versionColumnName}", "date_migrated") VALUES (?, ?, ?);`,
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
  if (column.default != null) {
    columnQuery.push(`DEFAULT ${wrapValue(column.default)}`);
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
  if (tables[name] != null) {
    removeTable(name);
  }

  tables[name] = {
    columns: {},
    primaryKeys: {},
    params: {},
  };

  for (const [columnName, column] of Object.entries(columns)) {
    if (column.id) {
      column.type = "INTEGER";
      column.primaryKey = true;
      column.autoIncrement = true;
    }

    tables[name].columns[columnName] = { type: column.type };
  }

  addSql(getTableCreationSqlQuery(name, columns));
}

function recreateTable(tableName, columns) {
  if (columns == null) {
    columns = tables[tableName].columns;
  }

  const tempTableName = tableName + "_tmp";

  addSql(getTableCreationSqlQuery(tempTableName, columns));

  const recreatedColumnCurrent = [];
  const recreatedColumnPrevious = [];

  for (const columnName of Object.keys(columns)) {
    const params = tables[tableName].params[columnName] ?? EMPTY_OBJECT;

    recreatedColumnCurrent.push(`"${columnName}"`);

    const previous = params.fillFrom ?? columnName;

    recreatedColumnPrevious.push(
      params.coalesce
        ? `COALESCE("${previous}", ${wrapValue(params.coalesce)})`
        : `"${previous}"`
    );
  }

  addSql(
    `INSERT INTO "${tempTableName}" (${recreatedColumnCurrent.join(
      ", "
    )}) SELECT ${recreatedColumnPrevious.join(", ")} FROM "${tableName}";`
  );

  addSql(`DROP TABLE "${tableName}";`);
  addSql(`ALTER TABLE "${tempTableName}" RENAME TO "${tableName}";`);
}

function removeTable(tableName) {
  addSql(`DROP TABLE "${tableName}";`);
}

function addTableColumn(tableName, columnName, column, params) {
  tables[tableName].columns[columnName] = column;
  if (params != null) {
    tables[tableName].params[columnName] = params;
  }

  const alterQuery = `ALTER TABLE "${tableName}" ADD COLUMN ${getColumnQueryPart(
    columnName,
    column
  )};`;
  addSql(alterQuery);
}

function renameTableColumn(tableName, columnName, newColumnName) {
  tables[tableName].columns[newColumnName] =
    tables[tableName].columns[columnName];
  delete tables[tableName].columns[columnName];

  const query = `ALTER TABLE "${tableName}" RENAME COLUMN "${columnName}" TO "${newColumnName}";`;
  addSql(query);
}

function changeTableColumn(tableName, columnName, column, params) {
  if (column != null) {
    tables[tableName].columns[columnName] = column;
  }
  if (params != null) {
    tables[tableName].params[columnName] = params;
  }
}

function deleteTableColumn(tableName, columnName) {
  delete tables[tableName].columns[columnName];
}

function getMigrationTableSqlCreateQuery() {
  return `CREATE TABLE IF NOT EXISTS "migrations" ("revision" INTEGER NOT NULL PRIMARY KEY, "${versionColumnName}" TEXT NOT NULL, "date_migrated" INTEGER NOT NULL);`;
}

function getMigrationRevisionSqlSelectQuery() {
  return `SELECT MAX(revision) as "latest_revision", "${versionColumnName}", "date_migrated" FROM "migrations";`;
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
        latestMigration[versionColumnName]
      })`
    );
  } else {
    latestMigration.latest_revision = -1;
    console.log(`Migration history is empty`);
  }

  if (latestMigration.latest_revision < migrations.length) {
    console.log(`Target migration revision ID: ${migrations.length - 1}`);
    for (
      let revision = latestMigration.latest_revision + 1;
      revision < migrations.length;
      revision++
    ) {
      if (migrations[revision] != null) {
        queries.push(...migrations[revision]);
      }
    }
  }

  queries.push({ query: "COMMIT TRANSACTION;" });
  queries.push({ query: "VACUUM;" });

  console.log(`...SQL queries have been generated`);

  return queries;
}

function wrapValue(value) {
  return typeof value === "string" ? `'${value}'` : value;
}

export default function (_versionColumnName) {
  resetContext();
  versionColumnName = _versionColumnName ?? "app_version";
  return {
    getSqlDialect,
    setSqlDialect,
    createMigration,
    addSql,
    createTable,
    recreateTable,
    removeTable,
    addTableColumn,
    renameTableColumn,
    changeTableColumn,
    deleteTableColumn,
    getMigrationTableSqlCreateQuery,
    getMigrationRevisionSqlSelectQuery,
    getMigrationsSqlQueries,
  };
}
