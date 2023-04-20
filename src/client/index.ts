async function main(): Promise<void> {
    var db = new PouchDB('pictures');
    db.replicate.to('/db');
    db.replicate.from('/db');
    
    db.post({
      name: 'David',
      age: 69
    });
        
    const docs = await db.allDocs({
        include_docs: true,
        attachments: true
    });
    
    console.log(JSON.stringify(docs));
}

main().catch(e => console.error(e));