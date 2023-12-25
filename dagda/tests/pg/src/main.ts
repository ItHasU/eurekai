import { PGRunner } from "@dagda/server/sql/impl/pg.runner";
import { SQLConnection } from "@dagda/server/sql/runner";
import { getEnvString } from "@dagda/server/tools/config";
import { BaseDTO } from "@dagda/shared/sql/types";

interface UserDTO extends BaseDTO {
    id: number;
    name: string;
}

type Tables = {
    users: UserDTO;
};


async function _main(): Promise<void> {
    const connectionString = getEnvString("DATABASE_URL");
    console.log("Connecting to database...");
    const runner = new PGRunner<Tables>({
        users: {
            name: false
        }
    }, connectionString);

    await runner.initTable("users", {
        name: "TEXT NOT NULL"
    });

    console.log("Connected to database");

    await runner.withTransaction(async (connection: SQLConnection) => {
        try {
            await connection.run("CREATE SCHEMA IF NOT EXISTS test");
        } catch (e) {
            // Ignore error
            console.log(`Schema creation failed: ${e}`);
        }
    });
}

_main().catch(console.error.bind(console));
