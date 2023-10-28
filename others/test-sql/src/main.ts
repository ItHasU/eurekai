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
    const group: GroupDTO = {
        id: 0,
        name: "Avengers"
    };
    t0.insert("groups", group);

    const user: UserDTO = {
        id: 0,
        name: "Tony stark",
        groupId: group.id // Here we use the temporary id, it will be updated by submit()
    };
    t0.insert("users", user);

    t0.update("users", user, { groupId: null });
    t0.delete("groups", group.id);
    t0.delete("users", user.id);

    await handler.submit(t0);
}

main().catch(e => console.error(e));