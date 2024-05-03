# Migratta

_By Cinnabar Forge_

**DISCLAIMER**: Until version 1.0.0, all versions below should be considered unstable and are subject to change.

## Getting Started

### Installation

Install Migratta using npm:

```bash
npm install migratta
```

### Usage

Example (using Cinnabar Forge SQLite Wrapper):

```javascript
import fs from "fs";
import cfSqlite3 from "@cinnabar-forge/cf-sqlite3";
import cfMigrations from "migratta";

const db = cfSqlite3("./default.sqlite");

const migrations = cfMigrations();

await db.exec(migrations.getMigrationTableSqlCreateQuery());

const latestRevision = await db.get(
  migrations.getMigrationRevisionSqlSelectQuery()
);

migrations = cfMigrations();

// Initial migration
migrations.createMigration();
migrations.createTable("species", {
id: { type: "ID" },
name: { default: "Unnamed species", notNull: true, type: "TEXT" },
origin: { type: "TEXT" },
population: { type: "INTEGER" },
});

// Rename column
migrations.createMigration();
migrations.renameTableColumn("species", "origin", "place_of_origin");

// Apply queries
const queries: Query[] = migrations.getMigrationsSqlQueries(latestRevision);
for (const query of queries) {
  // Run queries (query.query, query.args)
}
```

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, feel free to open an issue or create a pull request.

Clone the repository and install dependencies:

```bash
git clone git@github.com:cinnabar-forge/migratta.git
cd migratta
npm install
```

## License

Migratta is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Authors

- Timur Moziev ([@TimurRin](https://github.com/TimurRin))
