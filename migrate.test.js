import cfMigrations from "./migrate.js";
import assert from "assert";

let migrations = cfMigrations();

function createBaseMigration() {
  migrations = cfMigrations("dw_version");
  migrations.createMigration();
  migrations.createTable("species", {
    id: { id: true },
    name: { type: "TEXT", notNull: true },
    origin: { type: "TEXT" },
    population: { type: "INTEGER" },
  });
}

describe("Static functions", function () {
  it("should return expected getMigrationTableSqlCreateQuery string", function () {
    assert.strictEqual(
      migrations.getMigrationTableSqlCreateQuery(),
      `CREATE TABLE IF NOT EXISTS "migrations" ("revision" INTEGER NOT NULL PRIMARY KEY, "app_version" TEXT NOT NULL, "date_migrated" INTEGER NOT NULL);`
    );
  });
  it("should return expected getMigrationRevisionSqlSelectQuery string", function () {
    assert.strictEqual(
      migrations.getMigrationRevisionSqlSelectQuery(),
      `SELECT MAX(revision) as "latest_revision", "app_version", "date_migrated" FROM "migrations";`
    );
  });
  it("should return correct SQL query", function () {
    const queries = migrations.getMigrationsSqlQueries({});
    assert.strictEqual(queries[0].query, "BEGIN TRANSACTION;");
    assert.strictEqual(queries[1].query, "COMMIT TRANSACTION;");
    assert.strictEqual(queries[2].query, "VACUUM;");
  });
});

describe("Adding SQL", function () {
  it("should add a SQL query", function () {
    migrations = cfMigrations("test_version");
    migrations.createMigration();
    migrations.addSql("SELECT 15 AS testPurpose;");
  });
  it("should return correct SQL query", function () {
    const queries = migrations.getMigrationsSqlQueries({});
    assert.strictEqual(queries[0].query, "BEGIN TRANSACTION;");
    assert.strictEqual(
      queries[1].query,
      `INSERT INTO "migrations" (revision, test_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[2].query, "SELECT 15 AS testPurpose;");
    assert.strictEqual(queries[3].query, "COMMIT TRANSACTION;");
    assert.strictEqual(queries[4].query, "VACUUM;");
  });
});

describe("Creating new table", function () {
  it("should create a table 'species'", function () {
    createBaseMigration();
  });
  it("should return correct SQL query", function () {
    const queries = migrations.getMigrationsSqlQueries({});
    assert.strictEqual(queries[0].query, "BEGIN TRANSACTION;");
    assert.strictEqual(
      queries[1].query,
      `INSERT INTO "migrations" (revision, dw_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[1].args.length, 3);
    assert.strictEqual(
      queries[2].query,
      `CREATE TABLE "species" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "origin" TEXT, "population" INTEGER);`
    );
    assert.strictEqual(queries[3].query, "COMMIT TRANSACTION;");
    assert.strictEqual(queries[4].query, "VACUUM;");
  });
});

describe("Creating new column", function () {
  it("should create a table 'species'", function () {
    createBaseMigration();
  });
  it("should add a column 'language' with type 'TEXT'", function () {
    migrations.createMigration();
    migrations.addTableColumn("species", "language", { type: "TEXT" });
  });
  it("should return correct SQL query", function () {
    const queries = migrations.getMigrationsSqlQueries({});
    assert.strictEqual(queries[0].query, "BEGIN TRANSACTION;");
    assert.strictEqual(
      queries[1].query,
      `INSERT INTO "migrations" (revision, dw_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[1].args.length, 3);
    assert.strictEqual(
      queries[2].query,
      `CREATE TABLE "species" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "origin" TEXT, "population" INTEGER);`
    );
    assert.strictEqual(
      queries[3].query,
      `INSERT INTO "migrations" (revision, dw_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[3].args.length, 3);
    assert.strictEqual(
      queries[4].query,
      `ALTER TABLE "species" ADD COLUMN "language" TEXT;`
    );
    assert.strictEqual(queries[5].query, "COMMIT TRANSACTION;");
    assert.strictEqual(queries[6].query, "VACUUM;");
  });
});

describe("Changing existing column type", function () {
  it("should create a table 'species'", function () {
    createBaseMigration();
  });
  it("should change type of the column 'origin' from 'TEXT' to 'INTEGER' and make it not-null", function () {
    migrations.createMigration();
    migrations.changeTableColumn("species", "origin", {
      type: "INTEGER",
      notNull: true,
    });
  });
  it("should return correct SQL query", function () {
    const queries = migrations.getMigrationsSqlQueries({});
    assert.strictEqual(queries[0].query, "BEGIN TRANSACTION;");
    assert.strictEqual(
      queries[1].query,
      `INSERT INTO "migrations" (revision, dw_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[1].args.length, 3);
    assert.strictEqual(
      queries[2].query,
      `CREATE TABLE "species" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "origin" TEXT, "population" INTEGER);`
    );
    assert.strictEqual(
      queries[3].query,
      `INSERT INTO "migrations" (revision, dw_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[3].args.length, 3);
    assert.strictEqual(
      queries[4].query,
      `CREATE TABLE "species_tmp" ("id" INTEGER, "name" TEXT, "origin" INTEGER NOT NULL, "population" INTEGER);`
    );
    assert.strictEqual(
      queries[5].query,
      `INSERT INTO species_tmp (id, name, origin, population) SELECT id, name, origin, population FROM species;`
    );
    assert.strictEqual(queries[6].query, `DROP TABLE "species";`);
    assert.strictEqual(
      queries[7].query,
      `ALTER TABLE "species_tmp" RENAME TO "species";`
    );
    assert.strictEqual(queries[8].query, "COMMIT TRANSACTION;");
    assert.strictEqual(queries[9].query, "VACUUM;");
  });
});

describe("Renaming existing column", function () {
  it("should create a table 'species'", function () {
    createBaseMigration();
  });
  it("should change name of the column 'origin' to 'place_of_origin'", function () {
    migrations.createMigration();
    migrations.renameTableColumn("species", "origin", "place_of_origin");
  });
  it("should return correct SQL query", function () {
    const queries = migrations.getMigrationsSqlQueries({});
    assert.strictEqual(queries[0].query, "BEGIN TRANSACTION;");
    assert.strictEqual(
      queries[1].query,
      `INSERT INTO "migrations" (revision, dw_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[1].args.length, 3);
    assert.strictEqual(
      queries[2].query,
      `CREATE TABLE "species" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "origin" TEXT, "population" INTEGER);`
    );
    assert.strictEqual(
      queries[3].query,
      `INSERT INTO "migrations" (revision, dw_version, date_migrated) VALUES (?, ?, ?);`
    );
    assert.strictEqual(queries[3].args.length, 3);
    assert.strictEqual(
      queries[4].query,
      `ALTER TABLE "species" RENAME COLUMN "origin" TO "place_of_origin";`
    );
    assert.strictEqual(queries[5].query, "COMMIT TRANSACTION;");
    assert.strictEqual(queries[6].query, "VACUUM;");
  });
});
