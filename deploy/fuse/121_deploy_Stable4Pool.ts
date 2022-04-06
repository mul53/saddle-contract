import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute, get, getOrNull, log, read, save } = deployments
  const { deployer } = await getNamedAccounts()

  // Manually check if the pool is already deployed
  const vUSD2Pool = await getOrNull("vUSD2Pool")
  if (vUSD2Pool) {
    log(`reusing "vUSD2Pool" at ${vUSD2Pool.address}`)
  } else {
    // Constructor arguments
    const TOKEN_ADDRESSES = [
      (await get("FUSD")).address,
      (await get("USDT")).address,
      (await get("atUST")).address,
    ]
    const TOKEN_DECIMALS = [18, 6, 18]
    const LP_TOKEN_NAME = "vUSD2 LP Token"
    const LP_TOKEN_SYMBOL = "vUSD2"
    const INITIAL_A = 200
    const SWAP_FEE = 3e7 // 30bps
    const ADMIN_FEE = 3e9 // 30% of swap fee

    await execute(
      "SwapFlashLoan",
      { from: deployer, log: true },
      "initialize",
      TOKEN_ADDRESSES,
      TOKEN_DECIMALS,
      LP_TOKEN_NAME,
      LP_TOKEN_SYMBOL,
      INITIAL_A,
      SWAP_FEE,
      ADMIN_FEE,
      (
        await get("LPToken")
      ).address,
    )

    await save("vUSD2Pool", {
      abi: (await get("SwapFlashLoan")).abi,
      address: (await get("SwapFlashLoan")).address,
    })

    await save("vUSD2AmplificationUtils", {
      abi: (await get("AmplificationUtils")).abi,
      address: (await get("AmplificationUtils")).address,
    })

    await save("vUSD2SwapUtils", {
      abi: (await get("SwapUtils")).abi,
      address: (await get("SwapUtils")).address,
    })

    const lpTokenAddress = (await read("vUSD2Pool", "swapStorage")).lpToken
    log(`vUSD2 LP Token at ${lpTokenAddress}`)

    await save("vUSD2LPToken", {
      abi: (await get("LPToken")).abi, // LPToken ABI
      address: lpTokenAddress,
    })

    await execute(
      "vUSD2Pool",
      { from: deployer, log: true },
      "transferOwnership",
      "0x03709784c96aeaAa9Dd38Df14A23e996681b2C66",
    )
  }
}
export default func
func.tags = ["vUSD2Pool"]
func.dependencies = ["SwapUtils", "SwapFlashLoan", "vUSD2PoolTokens"]
