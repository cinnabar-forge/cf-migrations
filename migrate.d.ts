declare module "@cinnabar-forge/cf-migrations" {
  export type Column = {
    type?: "NULL" | "INTEGER" | "REAL" | "TEXT" | "BLOB";
    id?: boolean;
    primaryKey?: boolean;
    autoIncrement?: boolean;
    notNull?: boolean;
    unique?: boolean;
  };
  export type LastMigration = {
    latest_revision: string;
    app_version: string;
    date_migrated: number;
  };
  export type Query = { query: string; args: any[] };

  export default function (_versionColumnName?: string): {
    resetContext: () => void;
    getSqlDialect: () => string;
    setSqlDialect: (value: string) => void;
    createMigration: () => void;
    addSql: (query: string, params: any[]) => void;
    createTable: (name: string, columns: Record<string, Column>) => void;
    addTableColumn: (
      tableName: string,
      columnName: string,
      column: Column
    ) => void;
    renameTableColumn: (
      tableName: string,
      columnName: string,
      newColumnName: string
    ) => void;
    changeTableColumn: (
      tableName: string,
      columnName: string,
      column: Column
    ) => void;
    getMigrationTableSqlCreateQuery: () => string;
    getMigrationRevisionSqlSelectQuery: () => string;
    getMigrationsSqlQueries: (latestMigration: LastMigration) => Query[];
  };
}
