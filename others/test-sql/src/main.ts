import { SQLDummyConnector } from "@dagda/sql-shared/src/sql.dummy.connector";
import { SQLHandler } from "@dagda/sql-shared/src/sql.handler";
import { BaseDTO } from "@dagda/sql-shared/src/sql.types"

type TestTables = {
    users: UserDTO,
    groups: GroupDTO
}

interface UserDTO extends BaseDTO {
    name: string;
    groupId: number;
}

interface GroupDTO extends BaseDTO {
    name: string;
}

const connector = new SQLDummyConnector<TestTables>({
    "users": [
        {
            id: 1,
            name: "Tony stark",
            groupId: 1
        },
        {
            id: 2,
            name: "Captain America",
            groupId: 1
        },
        {
            id: 3,
            name: "Superman",
            groupId: 2
        },
        {
            id: 4,
            name: "Batman",
            groupId: 2
        }
    ],
    "groups": [
        {
            id: 1,
            name: "Avengers"
        },
        {
            id: 2,
            name: "Justice League"
        }
    ]
})

const handler = new SQLHandler<TestTables>(connector);

async function main() {
    console.log("Loading...");
    await handler.loadTable("users");
    await handler.loadTable("groups");
    console.log("Reading data...")
    const ironman = handler.getById("users", 1);
    const group = handler.getById("groups", ironman!.groupId);
    console.log(ironman, group);
}

main().catch(e => console.error(e));