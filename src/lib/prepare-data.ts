import fs from "fs"
import path from "path"
import {getTop500Payload, mapTop500Rows} from "@/lib/data";

async function main() {
    const payload = await getTop500Payload()
    const artists = mapTop500Rows(payload)
    fs.writeFileSync(
        path.join(process.cwd(), "public", "_top500.json"),
        JSON.stringify(artists, null, 2)
    )
    console.log("✅ Generated public/_top500.json")
}

main()
