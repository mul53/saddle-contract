import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { isTestNetwork } from "../../utils/network"
import { BigNumber } from "ethers"

const USD_TOKENS_ARGS: { [token: string]: any[] } = {
  FUSD: ["Fuse Dollar", "fUSD", "18"],
  OneFuse: ["oneFUSE on Fuse", "oneFUSE", "18"],
  BUSD: ["Binance USD on Fuse", "BUSD", "18"],
  USDT: ["Tether USD on Fuse", "USDT", "6"],
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  //   throw new Error("");
  const { deployments, getNamedAccounts, getChainId } = hre
  const { deploy, execute } = deployments
  const { deployer } = await getNamedAccounts()

  for (const token in USD_TOKENS_ARGS) {
    await deploy(token, {
      from: deployer,
      log: true,
      contract: "GenericERC20",
      args: USD_TOKENS_ARGS[token],
      skipIfAlreadyDeployed: true,
    })
    // If it's on hardhat, mint test tokens
    if (isTestNetwork(await getChainId())) {
      const decimals = USD_TOKENS_ARGS[token][2]
      await execute(
        token,
        { from: deployer, log: true },
        "mint",
        deployer,
        BigNumber.from(10).pow(decimals).mul(1000000),
      )
    }
  }
}
export default func
func.tags = ["Stable4PoolTokens"]