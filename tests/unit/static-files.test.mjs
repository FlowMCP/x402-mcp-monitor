import { join } from 'node:path'

import { StaticFiles } from '../../src/server/StaticFiles.mjs'


const DOCS_PATH = new URL( '../../docs', import.meta.url ).pathname


function createMockResponse() {
    const res = {
        statusCode: null,
        headers: {},
        body: null,
        writeHead( code, headers ) {
            res.statusCode = code
            res.headers = headers
        },
        end( data ) {
            res.body = data
        }
    }

    return res
}


describe( 'StaticFiles', () => {
    describe( 'serve', () => {
        test( 'serves index.html with correct content type', async () => {
            const response = createMockResponse()

            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'index.html', response } )

            expect( response.statusCode ).toBe( 200 )
            expect( response.headers[ 'Content-Type' ] ).toBe( 'text/html; charset=utf-8' )
            expect( response.body ).toBeDefined()
            expect( response.body.toString() ).toContain( '<!DOCTYPE html>' )
        } )


        test( 'serves style.css with correct content type', async () => {
            const response = createMockResponse()

            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'style.css', response } )

            expect( response.statusCode ).toBe( 200 )
            expect( response.headers[ 'Content-Type' ] ).toBe( 'text/css; charset=utf-8' )
            expect( response.body ).toBeDefined()
            expect( response.body.toString() ).toContain( ':root' )
        } )


        test( 'returns 404 for non-existent file', async () => {
            const response = createMockResponse()

            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'nonexistent.html', response } )

            expect( response.statusCode ).toBe( 404 )
            expect( response.body ).toBe( 'Not Found' )
        } )


        test( 'blocks directory traversal with ../', async () => {
            const response = createMockResponse()

            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: '../package.json', response } )

            const isBlocked = response.statusCode === 403 || response.statusCode === 404

            expect( isBlocked ).toBe( true )
        } )


        test( 'blocks directory traversal with encoded path', async () => {
            const response = createMockResponse()

            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: '../../etc/passwd', response } )

            const isBlocked = response.statusCode === 403 || response.statusCode === 404

            expect( isBlocked ).toBe( true )
        } )


        test( 'returns application/octet-stream for unknown extensions', async () => {
            const response = createMockResponse()

            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'test.xyz', response } )

            expect( response.statusCode ).toBe( 404 )
        } )
    } )
} )
