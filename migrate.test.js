import cfMigrations from "./migrate.js";
import assert from "assert";

function createBaseMigration() {
  cfMigrations.resetContext();
  cfMigrations.createMigration();
  cfMigrations.createTable("species", {
    id: { id: true },
    name: { type: "text", notNull: true },
    origin: { type: "text" },
    population: { type: "integer" },
  });
}

describe("Empty run", function () {
  it("should return correct SQL query", function () {
    assert.equal(
      cfMigrations.getMigrationRevisionSqlQuery(),
      "CREATE TABLE IF NOT EXISTS migrations (revision INTEGER NOT NULL PRIMARY KEY, app_version TEXT NOT NULL, date_migrated INTEGER NOT NULL); SELECT MAX(revision) as latest_revision, app_version, date_migrated FROM migrations;"
    );
  });
  it("should return correct SQL query", function () {
    const query = cfMigrations.getMigrationsSqlBundle({});
    assert.equal(
      query.query,
      `BEGIN TRANSACTION;
COMMIT TRANSACTION;
VACUUM;`
    );
    assert.equal(query.args.length, 0);
  });
});

describe("Adding SQL", function () {
  it("should add a SQL query", function () {
    cfMigrations.createMigration();
    cfMigrations.addSql("VACUUM;", ["testPurposes"]);
  });
  it("should return correct SQL query", function () {
    const query = cfMigrations.getMigrationsSqlBundle({});
    assert.equal(
      query.query,
      `BEGIN TRANSACTION;
INSERT INTO migrations (revision, app_version, date_migrated) VALUES (?, ?, ?);
VACUUM;
COMMIT TRANSACTION;
VACUUM;`
    );
    assert.equal(query.args.length, 4);
  });
});

describe("Creating new table", function () {
  it("should create a table", function () {
    createBaseMigration();
  });
  it("should return correct SQL query", function () {
    const query = cfMigrations.getMigrationsSqlBundle({});
    assert.equal(
      query.query,
      `BEGIN TRANSACTION;
INSERT INTO migrations (revision, app_version, date_migrated) VALUES (?, ?, ?);
CREATE TABLE "species" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "origin" TEXT, "population" INTEGER);
COMMIT TRANSACTION;
VACUUM;`
    );
    assert.equal(query.args.length, 3);
  });
});

describe("Creating new column", function () {
  it("should create a table", function () {
    createBaseMigration();
  });
  it("should add a column", function () {
    cfMigrations.createMigration();
    cfMigrations.addTableColumn("species", "language", { type: "text" });
  });
  it("should return correct SQL query", function () {
    const query = cfMigrations.getMigrationsSqlBundle({});
    assert.equal(
      query.query,
      `BEGIN TRANSACTION;
INSERT INTO migrations (revision, app_version, date_migrated) VALUES (?, ?, ?);
CREATE TABLE "species" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "origin" TEXT, "population" INTEGER);
INSERT INTO migrations (revision, app_version, date_migrated) VALUES (?, ?, ?);
ALTER TABLE "species" ADD COLUMN "language" TEXT;
COMMIT TRANSACTION;
VACUUM;`
    );
    assert.equal(query.args.length, 6);
  });
});
