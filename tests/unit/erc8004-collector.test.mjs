import { jest } from '@jest/globals'

import { Erc8004Collector } from '../../src/collector/Erc8004Collector.mjs'


describe( 'Erc8004Collector', () => {
    const originalFetch = globalThis.fetch


    afterEach( () => {
        globalThis.fetch = originalFetch
    } )


    describe( 'collect', () => {
        test( 'returns empty when no new blocks', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => ( {
                    jsonrpc: '2.0',
                    id: 1,
                    result: '0x1740000'
                } )
            } )

            const result = await Erc8004Collector.collect( {
                alchemyUrl: 'https://eth-mainnet.g.alchemy.com/v2/test',
                fromBlock: 24444928,
                contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'returns error on RPC failure', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: false,
                status: 429
            } )

            const result = await Erc8004Collector.collect( {
                alchemyUrl: 'https://eth-mainnet.g.alchemy.com/v2/test',
                fromBlock: 24339925,
                contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
            } )

            expect( result[ 'status' ] ).toBe( false )
            expect( result[ 'error' ] ).toContain( '429' )
        } )


        test( 'returns error on network failure', async () => {
            globalThis.fetch = jest.fn().mockRejectedValue( new Error( 'Connection refused' ) )

            const result = await Erc8004Collector.collect( {
                alchemyUrl: 'https://eth-mainnet.g.alchemy.com/v2/test',
                fromBlock: 24339925,
                contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
            } )

            expect( result[ 'status' ] ).toBe( false )
            expect( result[ 'error' ] ).toBe( 'Connection refused' )
        } )


        test( 'handles RPC error in response', async () => {
            let callCount = 0
            globalThis.fetch = jest.fn().mockImplementation( async () => {
                callCount += 1

                if( callCount === 1 ) {
                    return {
                        ok: true,
                        json: async () => ( {
                            jsonrpc: '2.0',
                            id: 1,
                            result: `0x${( 24339925 + 500 ).toString( 16 )}`
                        } )
                    }
                }

                return {
                    ok: true,
                    json: async () => ( {
                        jsonrpc: '2.0',
                        id: 1,
                        error: { message: 'Rate limit exceeded' }
                    } )
                }
            } )

            const result = await Erc8004Collector.collect( {
                alchemyUrl: 'https://eth-mainnet.g.alchemy.com/v2/test',
                fromBlock: 24339925,
                contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
            } )

            expect( result[ 'status' ] ).toBe( false )
            expect( result[ 'error' ] ).toContain( 'Rate limit' )
        } )


        test( 'processes empty logs array', async () => {
            let callCount = 0
            globalThis.fetch = jest.fn().mockImplementation( async () => {
                callCount += 1

                if( callCount === 1 ) {
                    return {
                        ok: true,
                        json: async () => ( {
                            jsonrpc: '2.0',
                            id: 1,
                            result: `0x${( 24339925 + 100 ).toString( 16 )}`
                        } )
                    }
                }

                return {
                    ok: true,
                    json: async () => ( {
                        jsonrpc: '2.0',
                        id: 1,
                        result: []
                    } )
                }
            } )

            const result = await Erc8004Collector.collect( {
                alchemyUrl: 'https://eth-mainnet.g.alchemy.com/v2/test',
                fromBlock: 24339925,
                contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
            expect( result[ 'lastProcessedBlock' ] ).toBe( 24339925 + 100 )
        } )


        test( 'throws on missing alchemyUrl', async () => {
            await expect(
                Erc8004Collector.collect( {
                    fromBlock: 24339925,
                    contract: '0x8004'
                } )
            ).rejects.toThrow( 'alchemyUrl: Missing value' )
        } )


        test( 'throws on missing fromBlock', async () => {
            await expect(
                Erc8004Collector.collect( {
                    alchemyUrl: 'https://test.com',
                    contract: '0x8004'
                } )
            ).rejects.toThrow( 'fromBlock: Missing value' )
        } )


        test( 'throws on missing contract', async () => {
            await expect(
                Erc8004Collector.collect( {
                    alchemyUrl: 'https://test.com',
                    fromBlock: 24339925
                } )
            ).rejects.toThrow( 'contract: Missing value' )
        } )
    } )
} )
