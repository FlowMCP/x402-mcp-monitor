import { jest } from '@jest/globals'

import { BazaarCollector } from '../../src/collector/BazaarCollector.mjs'


const MOCK_BAZAAR_RESPONSE = {
    items: [
        {
            resource: 'https://api.premium.com/vault',
            type: 'api',
            x402Version: '1.0',
            lastUpdated: '2026-02-04T12:00:00.000Z',
            accepts: [
                {
                    resource: 'https://api.premium.com/vault',
                    network: 'eip155:8453',
                    scheme: 'exact',
                    asset: '0x8335...',
                    maxAmountRequired: '100000',
                    payTo: '0x1234...'
                }
            ]
        },
        {
            resource: 'https://api.data.com/query',
            type: 'api',
            x402Version: '1.0',
            lastUpdated: '2026-02-03T10:00:00.000Z',
            accepts: []
        }
    ],
    pagination: {
        total: 2,
        limit: 100,
        offset: 0
    }
}


describe( 'BazaarCollector', () => {
    const originalFetch = globalThis.fetch


    afterEach( () => {
        globalThis.fetch = originalFetch
    } )


    describe( 'collect', () => {
        test( 'collects resources with payment options', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => MOCK_BAZAAR_RESPONSE
            } )

            const result = await BazaarCollector.collect( {
                bazaarUrl: 'https://api.test.com/bazaar'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 2 )
            expect( result[ 'discoveries' ][ 0 ][ 'url' ] ).toBe( 'https://api.premium.com/vault' )
            expect( result[ 'discoveries' ][ 0 ][ 'protocol' ] ).toBe( 'mcp' )
            expect( result[ 'discoveries' ][ 0 ][ 'sourceData' ][ 'type' ] ).toBe( 'bazaar' )
            expect( result[ 'discoveries' ][ 0 ][ 'sourceData' ][ 'paymentOptions' ] ).toHaveLength( 1 )
            expect( result[ 'discoveries' ][ 0 ][ 'sourceData' ][ 'paymentOptions' ][ 0 ][ 'network' ] ).toBe( 'eip155:8453' )
        } )


        test( 'handles empty items', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => ( {
                    items: [],
                    pagination: { total: 0, limit: 100, offset: 0 }
                } )
            } )

            const result = await BazaarCollector.collect( {
                bazaarUrl: 'https://api.test.com/bazaar'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'skips resources with empty URLs', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => ( {
                    items: [
                        { resource: '', type: 'api', accepts: [] },
                        { resource: null, type: 'api', accepts: [] }
                    ],
                    pagination: { total: 2, limit: 100, offset: 0 }
                } )
            } )

            const result = await BazaarCollector.collect( {
                bazaarUrl: 'https://api.test.com/bazaar'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'returns error on API failure', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: false,
                status: 500
            } )

            const result = await BazaarCollector.collect( {
                bazaarUrl: 'https://api.test.com/bazaar'
            } )

            expect( result[ 'status' ] ).toBe( false )
            expect( result[ 'error' ] ).toContain( '500' )
        } )


        test( 'returns error on network failure', async () => {
            globalThis.fetch = jest.fn().mockRejectedValue( new Error( 'ECONNREFUSED' ) )

            const result = await BazaarCollector.collect( {
                bazaarUrl: 'https://api.test.com/bazaar'
            } )

            expect( result[ 'status' ] ).toBe( false )
            expect( result[ 'error' ] ).toBe( 'ECONNREFUSED' )
        } )


        test( 'throws on non-string bazaarUrl', async () => {
            await expect(
                BazaarCollector.collect( { bazaarUrl: 123 } )
            ).rejects.toThrow( 'bazaarUrl: Must be a string' )
        } )
    } )
} )
