// The web app keeps no databases in the browser (sqlite.web.ts): it reads everything online.
// Without this, any screen that imports the connection pulls expo-sqlite's native worker into
// the web bundle.
export { openSQLiteDatabase, type SQLiteDatabase } from './sqlite.web'
