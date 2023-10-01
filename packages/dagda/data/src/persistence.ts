

export class PersistenceManager<TableNames extends string, PersistenceFieldTypes extends string> {
    constructor() { }
}

export class ModelManager<ModelFieldTypes extends string, PersistenceFieldTypes extends string> {
    constructor(protected _persistenceManager: PersistenceManager) { }
}