import { SQLHandler } from "@dagda/sql-shared/src/sql.handler";
import { SQLTransaction } from "@dagda/sql-shared/src/sql.transaction";
import { BaseDTO, ForeignKeys } from "@dagda/sql-shared/src/sql.types"
import { SQLiteConnector } from "./sqlite.connector";

type TestTables = {
    users: UserDTO,
    groups: GroupDTO
}

interface UserDTO extends BaseDTO {
    name: string;
    groupId: number | null;
}

interface GroupDTO extends BaseDTO {
    name: string;
}

const APP_FOREIGN_KEYS: ForeignKeys<TestTables> = {
    users: {
        name: false,
        groupId: true
    },
    groups: {
        name: false
    }
};

const connector = new SQLiteConnector<TestTables>(APP_FOREIGN_KEYS, "./test.db");

const handler = new SQLHandler<TestTables>(connector);

async function main() {
    console.log("Creating tables...");
    await connector.initTable("users", {
        groupId: "INTEGER",
        name: "TEXT"
    });
    await connector.initTable("groups", {
        name: "TEXT"
    });

    console.log("Loading...");
    await handler.loadTable("users");
    await handler.loadTable("groups");

    const t0 = new SQLTransaction<TestTables>(handler);
    t0.insert("groups", {
        id: 0,
        name: "Avengers"
    })
    const groups = handler.getItems("groups");
    t0.insert("users", {
        id: 0,
        name: "Tony stark",
        groupId: groups[0].id
    });

    await handler.submit(t0);

    const users = handler.getItems("users");

    const t2 = new SQLTransaction<TestTables>(handler);
    t2.update("users", users[0], { groupId: null });
    t2.delete("groups", groups[0].id);

    await handler.submit(t2);

}

main().catch(e => console.error(e));