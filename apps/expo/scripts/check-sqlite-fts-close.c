/* Regression diagnostic for expo/expo#38168. Compile against the installed
 * expo-sqlite/ios/sqlite3.c with -DSQLITE_ENABLE_FTS5 -fsanitize=address.
 * Default: 100 safe FTS/query/integrity/close cycles. Argument "unsafe":
 * reproduce Expo's blanket finalization and its FTS5 use-after-free.
 * Uses synthetic in-memory data only; never opens an application database.
 */
#include "sqlite3.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
static void sql(sqlite3 *db, const char *query) {
  char *error = NULL;
  if (exsqlite3_exec(db, query, NULL, NULL, &error) != SQLITE_OK) {
    fprintf(stderr, "%s\n", error); exit(2);
  }
}
int main(int argc, char **argv) {
  int unsafe = argc > 1 && strcmp(argv[1], "unsafe") == 0;
  for (int i = 0; i < (unsafe ? 1 : 100); i++) {
    sqlite3 *db = NULL;
    if (exsqlite3_open(":memory:", &db) != SQLITE_OK) return 3;
    sql(db, "CREATE VIRTUAL TABLE notes USING fts5(text); INSERT INTO notes VALUES ('faith and works'); SELECT * FROM notes WHERE notes MATCH 'faith'; PRAGMA quick_check;");
    if (unsafe) {
      exsqlite3_stmt *stmt = exsqlite3_next_stmt(db, NULL);
      while (stmt) {
        exsqlite3_stmt *next = exsqlite3_next_stmt(db, stmt);
        exsqlite3_finalize(stmt);
        stmt = next;
      }
    }
    if (exsqlite3_close(db) != SQLITE_OK) return 4;
  }
  puts("100 FTS create/search/integrity/close cycles passed");
  return 0;
}
