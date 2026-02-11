import { Erc8004RegistryParser } from 'erc8004-registry-parser'


class AgentLookup {


    static #CONTRACTS = {
        'ETHEREUM_MAINNET': {
            proxy: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
        },
        'BASE_MAINNET': {
            proxy: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
        },
        'SEPOLIA_TESTNET': {
            proxy: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
        },
        'BASE_SEPOLIA_TESTNET': {
            proxy: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
        },
        'ARBITRUM_MAINNET': {
            proxy: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
        }
    }


    static #CHAIN_ID_TO_ALIAS = {
        1: 'ETHEREUM_MAINNET',
        8453: 'BASE_MAINNET',
        11155111: 'SEPOLIA_TESTNET',
        84532: 'BASE_SEPOLIA_TESTNET',
        42161: 'ARBITRUM_MAINNET'
    }


    static #CAIP2_TO_ALIAS = {
        'eip155:1': 'ETHEREUM_MAINNET',
        'eip155:8453': 'BASE_MAINNET',
        'eip155:11155111': 'SEPOLIA_TESTNET',
        'eip155:84532': 'BASE_SEPOLIA_TESTNET',
        'eip155:42161': 'ARBITRUM_MAINNET'
    }


    static #DEFAULT_RPC_NODES = {
        'ETHEREUM_MAINNET': 'https://eth.llamarpc.com',
        'BASE_MAINNET': 'https://mainnet.base.org',
        'SEPOLIA_TESTNET': 'https://rpc.sepolia.org',
        'BASE_SEPOLIA_TESTNET': 'https://sepolia.base.org',
        'ARBITRUM_MAINNET': 'https://arb1.arbitrum.io/rpc'
    }


    static #TOKEN_URI_SELECTOR = '0xc87b56dd'
    static #OWNER_OF_SELECTOR = '0x6352211e'
    static #GET_METADATA_SELECTOR = '0x75c1e5e0'
    static #REPUTATION_PROXY = '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'


    static async lookup( { agentId, chainId, rpcNodes = {}, timeout = 15000 } ) {
        const messages = []
        const result = {
            agentId,
            chainId,
            chainAlias: null,
            owner: null,
            agentUri: null,
            isOnChainVerified: false,
            isSpecCompliant: false,
            x402Support: null,
            isActive: null,
            services: null,
            supportedTrust: null,
            reputation: null,
            categories: null,
            entries: null
        }

        const { alias } = AgentLookup.#resolveChainAlias( { rawChainId: chainId } )

        if( alias === null ) {
            messages.push( `LKP-001 chainId: Unknown chain identifier "${chainId}"` )

            return { status: false, result, messages }
        }

        result[ 'chainAlias' ] = alias

        const rpcNode = rpcNodes[ alias ] || AgentLookup.#DEFAULT_RPC_NODES[ alias ] || null

        if( rpcNode === null ) {
            messages.push( `LKP-002 rpcNode: No RPC node available for chain "${alias}"` )

            return { status: false, result, messages }
        }

        const contracts = AgentLookup.#CONTRACTS[ alias ]

        if( !contracts ) {
            messages.push( `LKP-003 contracts: No contract addresses for chain "${alias}"` )

            return { status: false, result, messages }
        }

        try {
            const { agentUri, owner } = await AgentLookup.#queryOnChainAgent( {
                rpcNode,
                proxyAddress: contracts[ 'proxy' ],
                agentId,
                timeout
            } )

            result[ 'agentUri' ] = agentUri
            result[ 'owner' ] = owner

            if( agentUri === null ) {
                messages.push( 'LKP-010 registry: Agent not found in on-chain registry' )

                return { status: false, result, messages }
            }

            result[ 'isOnChainVerified' ] = true

            const parseResult = Erc8004RegistryParser.validateFromUri( {
                agentUri,
                agentId: String( agentId ),
                ownerAddress: owner
            } )

            const { categories: parsedCategories, entries: parsedEntries } = parseResult

            if( parsedCategories ) {
                result[ 'isSpecCompliant' ] = parsedCategories[ 'isSpecCompliant' ] || false
                result[ 'x402Support' ] = parsedCategories[ 'hasX402Support' ] || null
                result[ 'isActive' ] = parsedCategories[ 'isActive' ] || null
                result[ 'categories' ] = parsedCategories
            }

            if( parsedEntries ) {
                result[ 'services' ] = parsedEntries[ 'services' ] || null
                result[ 'supportedTrust' ] = parsedEntries[ 'supportedTrust' ] || null
                result[ 'entries' ] = parsedEntries
            }

            if( parseResult[ 'messages' ] && parseResult[ 'messages' ].length > 0 ) {
                parseResult[ 'messages' ]
                    .forEach( ( msg ) => {
                        messages.push( `LKP-030 spec: ${msg}` )
                    } )
            }
        } catch( error ) {
            messages.push( `LKP-020 eth_call: ${error.message}` )

            return { status: false, result, messages }
        }

        try {
            const { reputation, messages: repMessages } = await AgentLookup.#queryReputation( {
                rpcNode,
                agentId,
                timeout
            } )

            result[ 'reputation' ] = reputation

            repMessages
                .forEach( ( msg ) => {
                    messages.push( msg )
                } )
        } catch( error ) {
            messages.push( `LKP-040 reputation: ${error.message}` )
        }

        const hasErrors = messages
            .filter( ( msg ) => !msg.startsWith( 'REP-' ) && !msg.startsWith( 'LKP-040' ) )
            .length > 0

        return { status: !hasErrors, result, messages }
    }


    static #resolveChainAlias( { rawChainId } ) {
        if( typeof rawChainId === 'number' ) {
            const alias = AgentLookup.#CHAIN_ID_TO_ALIAS[ rawChainId ] || null

            return { alias }
        }

        if( typeof rawChainId === 'string' ) {
            const caipAlias = AgentLookup.#CAIP2_TO_ALIAS[ rawChainId ] || null

            if( caipAlias ) {
                return { alias: caipAlias }
            }

            const parsed = parseInt( rawChainId, 10 )

            if( !isNaN( parsed ) ) {
                const alias = AgentLookup.#CHAIN_ID_TO_ALIAS[ parsed ] || null

                return { alias }
            }
        }

        return { alias: null }
    }


    static async #queryOnChainAgent( { rpcNode, proxyAddress, agentId, timeout } ) {
        const paddedId = BigInt( agentId ).toString( 16 ).padStart( 64, '0' )

        const tokenUriData = `${AgentLookup.#TOKEN_URI_SELECTOR}${paddedId}`
        const ownerOfData = `${AgentLookup.#OWNER_OF_SELECTOR}${paddedId}`

        const [ uriResponse, ownerResponse ] = await Promise.allSettled( [
            AgentLookup.#ethCall( { rpcNode, to: proxyAddress, data: tokenUriData, timeout } ),
            AgentLookup.#ethCall( { rpcNode, to: proxyAddress, data: ownerOfData, timeout } )
        ] )

        let agentUri = null
        let owner = null

        if( uriResponse.status === 'fulfilled' && uriResponse.value[ 'result' ] ) {
            const { decoded } = AgentLookup.#decodeStringResult( { hex: uriResponse.value[ 'result' ] } )

            agentUri = decoded
        }

        if( ownerResponse.status === 'fulfilled' && ownerResponse.value[ 'result' ] ) {
            const rawOwner = ownerResponse.value[ 'result' ]

            if( rawOwner.length >= 42 ) {
                owner = `0x${rawOwner.slice( -40 )}`
            }
        }

        return { agentUri, owner }
    }


    static async #queryReputation( { rpcNode, agentId, timeout } ) {
        const messages = []
        const reputation = {
            feedbackCount: null,
            averageValue: null,
            valueDecimals: null,
            validationCount: null,
            averageResponse: null
        }

        const paddedId = BigInt( agentId ).toString( 16 ).padStart( 64, '0' )
        const metadataKey = 'reputation'
        const keyHex = Buffer.from( metadataKey, 'utf8' ).toString( 'hex' )
        const keyOffset = '0000000000000000000000000000000000000000000000000000000000000040'
        const keyLength = ( metadataKey.length ).toString( 16 ).padStart( 64, '0' )
        const keyPadded = keyHex.padEnd( 64, '0' )

        const data = `${AgentLookup.#GET_METADATA_SELECTOR}${paddedId}${keyOffset}${keyLength}${keyPadded}`

        const { result: metadataBytes } = await AgentLookup.#ethCall( {
            rpcNode,
            to: AgentLookup.#REPUTATION_PROXY,
            data,
            timeout
        } )

        if( metadataBytes === null || metadataBytes === '0x' || metadataBytes.length <= 2 ) {
            messages.push( 'REP-001: No reputation data found' )

            return { reputation, messages }
        }

        const { decoded } = AgentLookup.#decodeReputationData( { metadataBytes } )

        if( decoded !== null ) {
            reputation[ 'feedbackCount' ] = decoded[ 'feedbackCount' ]
            reputation[ 'averageValue' ] = decoded[ 'averageValue' ]
            reputation[ 'valueDecimals' ] = decoded[ 'valueDecimals' ]
            reputation[ 'validationCount' ] = decoded[ 'validationCount' ]
            reputation[ 'averageResponse' ] = decoded[ 'averageResponse' ]
        } else {
            messages.push( 'REP-001: No reputation data found' )
        }

        return { reputation, messages }
    }


    static async #ethCall( { rpcNode, to, data, timeout } ) {
        const controller = new AbortController()
        const timeoutId = setTimeout( () => { controller.abort() }, timeout )

        let response = null

        try {
            response = await fetch( rpcNode, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify( {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_call',
                    params: [ { to, data }, 'latest' ]
                } )
            } )
        } catch( error ) {
            clearTimeout( timeoutId )

            throw error
        }

        clearTimeout( timeoutId )

        if( !response.ok ) {
            throw new Error( `RPC returned HTTP ${response.status}` )
        }

        const json = await response.json()

        if( json[ 'error' ] ) {
            throw new Error( `RPC error: ${json[ 'error' ][ 'message' ]}` )
        }

        const result = json[ 'result' ] || null

        return { result }
    }


    static #decodeStringResult( { hex } ) {
        if( !hex || hex === '0x' || hex.length < 130 ) {
            return { decoded: null }
        }

        try {
            const clean = hex.startsWith( '0x' ) ? hex.slice( 2 ) : hex
            const offset = parseInt( clean.slice( 0, 64 ), 16 ) * 2
            const length = parseInt( clean.slice( offset, offset + 64 ), 16 )
            const strHex = clean.slice( offset + 64, offset + 64 + length * 2 )

            const decoded = Buffer.from( strHex, 'hex' ).toString( 'utf8' )

            return { decoded }
        } catch( _e ) {
            return { decoded: null }
        }
    }


    static #decodeReputationData( { metadataBytes } ) {
        try {
            const clean = metadataBytes.startsWith( '0x' ) ? metadataBytes.slice( 2 ) : metadataBytes

            if( clean.length < 128 ) {
                return { decoded: null }
            }

            const offset = parseInt( clean.slice( 0, 64 ), 16 ) * 2
            const length = parseInt( clean.slice( offset, offset + 64 ), 16 )
            const dataHex = clean.slice( offset + 64, offset + 64 + length * 2 )

            const jsonStr = Buffer.from( dataHex, 'hex' ).toString( 'utf8' )
            const decoded = JSON.parse( jsonStr )

            return { decoded }
        } catch( _e ) {
            return { decoded: null }
        }
    }
}


export { AgentLookup }
