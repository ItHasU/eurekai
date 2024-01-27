import { JSTypes } from "./javascript.types";
import { EntitiesModel } from "./model";

/** Custom type */
export enum PublicationStatus {
    DRAFT = 1,
    PUBLISHED
}

/** A test model with users and posts */
export const TEST_MODEL = new EntitiesModel({
    "USER_ID": {
        rawType: JSTypes.number
    },
    "POST_ID": {
        rawType: JSTypes.number
    },
    "INTEGER": {
        rawType: JSTypes.number
    },
    "TEXT": {
        rawType: JSTypes.string
    },
    "NAME": {
        rawType: JSTypes.string
    },
    "SURNAME": {
        rawType: JSTypes.string
    },
    "MARKDOWN": {
        rawType: JSTypes.string
    },
    "PUBLICATION_STATUS": EntitiesModel.type<JSTypes.number, PublicationStatus>({
        rawType: JSTypes.number
    })
}, {
    "users": {
        id: {
            type: "USER_ID",
            identity: true
        },
        name: {
            type: "NAME"
        },
        surname: {
            type: "SURNAME"
        },
        age: {
            type: "INTEGER",
            optional: true,
            fromVersion: 1 // Test a field added
        },
        size: {
            type: "INTEGER",
            optional: true,
            toVersion: 1 // Test a removed field
        }
    },
    "posts": {
        id: {
            type: "POST_ID",
            identity: true
        },
        author: {
            type: "USER_ID",
            foreignTable: "users"
        },
        title: {
            type: "TEXT"
        },
        content: {
            type: "MARKDOWN"
        },
        status: {
            type: "PUBLICATION_STATUS"
        }
    }
});