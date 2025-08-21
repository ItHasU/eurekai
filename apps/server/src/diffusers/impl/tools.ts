export function wakeOnLAN(wolString: string): Promise<void> {
    try {
        // Execute the WOL script
        await new Promise<boolean>((resolve, reject) => {
            console.log(`Sending WOL request (attempt ${i + 1}/${nbRetries})...`);
            console.log(wolScript);
            exec(wolScript, (error: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
        // -- Wait --
        await wait(timeout_ms);
    } catch (e) {
        console.error("Failed to send WOL request", e);
    }
}