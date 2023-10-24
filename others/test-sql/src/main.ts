import { SQLDummyConnector } from "@dagda/sql-shared/src/sql.dummy.connector";
import { SQLHandler } from "@dagda/sql-shared/src/sql.handler";
import { SQLTransaction } from "@dagda/sql-shared/src/sql.transaction";
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
    users: [],
    groups: []
});

// {
//     "users": [
//         {
//             id: 1,
//             name: "Tony stark",
//             groupId: 1
//         },
//         {
//             id: 2,
//             name: "Captain America",
//             groupId: 1
//         },
//         {
//             id: 3,
//             name: "Superman",
//             groupId: 2
//         },
//         {
//             id: 4,
//             name: "Batman",
//             groupId: 2
//         }
//     ],
//     "groups": [
//         {
//             id: 1,
//             name: "Avengers"
//         },
//         {
//             id: 2,
//             name: "Justice League"
//         }
//     ]
// }

const handler = new SQLHandler<TestTables>(connector);

async function main() {
    console.log("Loading...");
    await handler.loadTable("users");
    await handler.loadTable("groups");

    const t0 = new SQLTransaction<TestTables>(handler);
    try {
        t0.insert("groups", {
            id: 0,
            name: "Avengers"
        })
    } finally {
        await handler.submit(t0);
    }
    const groups = handler.getItems("groups");
    console.log(JSON.stringify(groups));

    const t1 = new SQLTransaction<TestTables>(handler);
    try {
        t1.insert("users", {
            id: 0,
            name: "Tony stark",
            groupId: groups[0].id
        });
    } finally {
        await handler.submit(t1);
    }

    const users = handler.getItems("users");
    console.log(JSON.stringify(users));

    // console.log("Reading data...")
    // const ironman = handler.getById("users", 1);
    // const group = handler.getById("groups", ironman!.groupId);
    // console.log(ironman, group);
}

main().catch(e => console.error(e));