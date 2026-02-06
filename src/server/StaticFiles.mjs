import { readFile } from 'node:fs/promises'
import { join, resolve, normalize } from 'node:path'


class StaticFiles {


    static #mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    }


    static async serve( { basePath, filePath, response } ) {
        const safePath = normalize( filePath ).replace( /^(\.\.(\/|\\|$))+/, '' )
        const fullPath = resolve( join( basePath, safePath ) )

        if( !fullPath.startsWith( resolve( basePath ) ) ) {
            response.writeHead( 403, { 'Content-Type': 'text/plain' } )
            response.end( 'Forbidden' )

            return
        }

        const ext = safePath.substring( safePath.lastIndexOf( '.' ) )
        const contentType = StaticFiles.#mimeTypes[ ext ] || 'application/octet-stream'

        try {
            const content = await readFile( fullPath )
            response.writeHead( 200, { 'Content-Type': contentType } )
            response.end( content )
        } catch( _err ) {
            response.writeHead( 404, { 'Content-Type': 'text/plain' } )
            response.end( 'Not Found' )
        }
    }
}


export { StaticFiles }
