import { readFile } from 'node:fs/promises'
import { join } from 'node:path'


class ManualCollector {
    static async collect( { dataPath } ) {
        try {
            const filePath = join( dataPath, 'manual.json' )
            const raw = await readFile( filePath, 'utf-8' )
            const data = JSON.parse( raw )
            const entries = data[ 'endpoints' ] || []

            const discoveries = entries
                .filter( ( entry ) => {
                    const { url } = entry

                    return url !== undefined && url !== null && url.trim().length > 0
                } )
                .map( ( entry ) => {
                    const { url, protocol, name, description, addedAt } = entry
                    const discovery = {
                        url,
                        protocol: protocol || 'mcp',
                        sourceData: {
                            type: 'manual',
                            name: name || null,
                            description: description || null,
                            addedAt: addedAt || new Date().toISOString(),
                            discoveredAt: new Date().toISOString()
                        }
                    }

                    return discovery
                } )

            return {
                status: true,
                discoveries,
                totalFetched: discoveries.length,
                error: null
            }
        } catch( error ) {
            return {
                status: true,
                discoveries: [],
                totalFetched: 0,
                error: null
            }
        }
    }
}


export { ManualCollector }
