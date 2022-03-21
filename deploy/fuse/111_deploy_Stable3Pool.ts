import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute, get, getOrNull, log, read, save } = deployments
  const { deployer } = await getNamedAccounts()

  // Manually check if the pool is already deployed
  const stable3Pool = await getOrNull("Stable3Pool")
  if (stable3Pool) {
    log(`reusing "Stable3Pool" at ${stable3Pool.address}`)
  } else {
    // Constructor arguments
    const TOKEN_ADDRESSES = [
      (await get("DAI")).address,
      (await get("USDC")).address,
      (await get("USDT")).address,
    ]
    const TOKEN_DECIMALS = [18, 6, 6]
    const LP_TOKEN_NAME = "Stable3 LP Token"
    const LP_TOKEN_SYMBOL = "S3LP"
    const INITIAL_A = 200
    const SWAP_FEE = 3e7 // 30bps
    const ADMIN_FEE = 5e9 // 50% of swap fee

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

    await save("Stable3Pool", {
      abi: (await get("SwapFlashLoan")).abi,
      address: (await get("SwapFlashLoan")).address,
    })

    const lpTokenAddress = (await read("Stable3Pool", "swapStorage")).lpToken
    log(`Stable3 LP Token at ${lpTokenAddress}`)

    await save("Stable3LPToken", {
      abi: (await get("LPToken")).abi, // LPToken ABI
      address: lpTokenAddress,
    })

    await execute(
      "Stable3Pool",
      { from: deployer, log: true },
      "transferOwnership",
      deployer,
    )
  }
}
export default func
func.tags = ["Stable3Pool"]
func.dependencies = ["SwapUtils", "SwapFlashLoan", "Stable3PoolTokens"]
