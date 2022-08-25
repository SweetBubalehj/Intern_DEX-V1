import { expect } from "chai"
import { ethers } from "hardhat"

const toWei = (value: any) => ethers.utils.parseEther(value.toString())

const fromWei = (value: any) =>
    ethers.utils.formatEther(
        typeof value === "string" ? value : value.toString()
    )

const dayInSeconds = 86400

const getBalance = ethers.provider.getBalance

const createExchange = async function (factory: any, tokenAddress: any, sender: any) {
    const exchangeAddress = await factory
        .connect(sender)
        .callStatic.createExchange(tokenAddress)

    await factory.connect(sender).createExchange(tokenAddress)

    const Exchange = await ethers.getContractFactory("InternExchange")

    return await Exchange.attach(exchangeAddress)
}

describe("Decentralized exchange", function () {
    let owner: any
    let user: any

    let dexToken: any
    let dexINT: any

    let token: any
    let factory: any

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners()

        const Factory = await ethers.getContractFactory("InternFactory")
        factory = await Factory.deploy()

        const Token = await ethers.getContractFactory("Token")
        token = await Token.deploy("Token", "TKN", toWei(1000000))

        dexToken = await createExchange(factory, token.address, owner)
        dexINT = await createExchange(factory, factory.address, owner)
    })

    it("is deployed", async function () {
        expect(await factory.deployed()).to.eq(factory)
        expect(await token.deployed()).to.eq(token)
        expect(await dexToken.deployed()).to.eq(dexToken)
        expect(await dexINT.deployed()).to.eq(dexINT)
    })

    describe("addLiquidity", function () {
        describe("empty reserves", function () {
            it("can add liquidity", async function () {
                await token.approve(dexToken.address, toWei(200))
                await dexToken.addLiquidity(toWei(200), { value: toWei(1) })

                expect(await getBalance(dexToken.address)).to.eq(toWei(1))
                expect(await dexToken.getTokenBalance()).to.eq(toWei(200))
            })

            it("allows zero amounts", async function () {
                await token.approve(dexToken.address, 0)
                await dexToken.addLiquidity(0, { value: 0 })

                expect(await getBalance(dexToken.address)).to.eq(0)
                expect(await dexToken.getTokenBalance()).to.eq(0)
            })
        })

        describe("existing reserves", function () {
            beforeEach(async function () {
                await token.approve(dexToken.address, toWei(100000))
                await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })
            })

            it("preserves balance", async function () {
                await token.approve(dexToken.address, toWei(15000))
                await dexToken.addLiquidity(toWei(15000), { value: toWei(10) })

                expect(await getBalance(dexToken.address))
                    .to.eq(toWei(110))

                expect(await dexToken.getTokenBalance()).to.equal(toWei(110000))
            })

            it("mints LP-tokens", async function () {
                await token.transfer(user.address, toWei(5000))
                await token.connect(user).approve(dexToken.address, toWei(5000))
                await dexToken.connect(user).addLiquidity(
                    toWei(5000),
                    { value: toWei(5) }
                )

                expect(await dexToken.balanceOf(user.address))
                    .to.eq(toWei(5))

                expect(await dexToken.balanceOf(owner.address))
                    .to.eq(toWei(100))

                expect(await dexToken.totalSupply())
                    .to.eq(toWei(105))
            })

            it("fails when not enough input amount", async function () {
                await token.approve(dexToken.address, toWei(1000))

                await expect(
                    dexToken.addLiquidity(toWei(1000), { value: toWei(100) })
                ).to.be.revertedWith("not enough input amount!")
            })
        })
    })



    describe("removeLiquidity", function () {
        beforeEach(async function () {
            await token.approve(dexToken.address, toWei(100000))
            await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })
        })

        it("removes some liquidity", async function () {
            const txRemove = dexToken.removeLiquidity(toWei(30))

            await expect(() => txRemove)
                .to.changeEtherBalances(
                    [owner.address, dexToken.address],
                    [toWei(30), toWei(-30)]
                )

            await expect(() => txRemove)
                .to.changeTokenBalances(
                    token,
                    [owner.address, dexToken.address],
                    [toWei(30000), toWei(-30000)]
                )

            expect(await dexToken.totalSupply())
                .to.eq(toWei(70))

            expect(await token.balanceOf(dexToken.address))
                .to.eq(toWei(70000))
        })

        it("removes all liquidity", async function () {
            const txRemove = dexToken.removeLiquidity(toWei(100))

            await expect(() => txRemove)
                .to.changeEtherBalances(
                    [owner.address, dexToken.address],
                    [toWei(100), toWei(-100)]
                )

            await expect(() => txRemove)
                .to.changeTokenBalances(
                    token,
                    [owner.address, dexToken.address],
                    [toWei(100000), toWei(-100000)]
                )

            expect(await dexToken.totalSupply())
                .to.eq(toWei(0))

            expect(await token.balanceOf(dexToken.address))
                .to.eq(toWei(0))
        })

        it("pays for provided liquidity", async function () {
            await dexToken.connect(user)
                .swapEtherToToken(toWei(9000), { value: toWei(10) })

            expect(await token.balanceOf(dexToken.address))
                .to.eq(toWei("90933.891061198508684187"))

            expect(await getBalance(dexToken.address))
                .to.eq(toWei(110))
        })

        it("burns LP-tokens", async function () {
            await expect(() =>
                dexToken.removeLiquidity(toWei(25))
            ).to.changeTokenBalance(dexToken, owner, toWei(-25))

            expect(await dexToken.totalSupply()).to.equal(toWei(75))
        })

        it("fails when enter invalid amount", async function () {
            await expect(dexToken.removeLiquidity(toWei(101)))
                .to.be.revertedWith(
                    "ERC20: burn amount exceeds balance"
                )
        })
    })

    describe("getTokenAmount", function () {
        it("returns correct price of Token", async function () {
            await token.approve(dexToken.address, toWei(100000))
            await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })

            let tokensOut = await dexToken.getTokenAmount(toWei(1))
            expect(fromWei(tokensOut))
                .to.eq("987.15803439706129885")

            tokensOut = await dexToken.getTokenAmount(toWei(10))
            expect(fromWei(tokensOut))
                .to.eq("9066.108938801491315813")

            tokensOut = await dexToken.getTokenAmount(toWei(50))
            expect(fromWei(tokensOut))
                .to.eq("33266.599933266599933266")

            tokensOut = await dexToken.getTokenAmount(toWei(100))
            expect(fromWei(tokensOut))
                .to.eq("49924.887330996494742113")

            tokensOut = await dexToken.getTokenAmount(toWei(1000))
            expect(fromWei(tokensOut))
                .to.eq("90884.229717411121239744")
        })
    })


    describe("getEtherAmount", function () {
        it("returns correct price of Ether", async function () {
            await token.approve(dexToken.address, toWei(100000))
            await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })

            let ethersOut = await dexToken.getEtherAmount(toWei(100))
            expect(fromWei(ethersOut))
                .to.eq("0.099600698103990321")

            ethersOut = await dexToken.getEtherAmount(toWei(5000))
            expect(fromWei(ethersOut))
                .to.eq("4.748297375815592703")

            ethersOut = await dexToken.getEtherAmount(toWei(50000))
            expect(fromWei(ethersOut))
                .to.eq("33.266599933266599933")

            ethersOut = await dexToken.getEtherAmount(toWei(100000))
            expect(fromWei(ethersOut))
                .to.eq("49.924887330996494742")

            ethersOut = await dexToken.getEtherAmount(toWei(1000000))
            expect(fromWei(ethersOut))
                .to.eq("90.884229717411121239")
        })
    })

    describe("swapEtherToToken", function () {
        beforeEach(async function () {
            await token.approve(dexToken.address, toWei(100000))
            await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })
        })

        it("swaps correctly", async function () {
            expect(await token.balanceOf(user.address)).to.eq(0)

            const txSwap = await dexToken.connect(user)
                .swapEtherToToken(toWei(9000), { value: toWei(10) })

            await expect(() => txSwap)
                .to.changeEtherBalances(
                    [user.address, dexToken.address],
                    [toWei(-10), toWei(10)]
                )

            await expect(() => txSwap)
                .to.changeTokenBalances(
                    token,
                    [user.address, dexToken.address],
                    [toWei("9066.108938801491315813"),
                    toWei("-9066.108938801491315813")]
                )

            expect(fromWei(await token.balanceOf(user.address)))
                .to.eq("9066.108938801491315813")

            expect(fromWei(await getBalance(dexToken.address)))
                .to.eq("110.0")

            expect(fromWei(await dexToken.getTokenBalance()))
                .to.eq("90933.891061198508684187")
        })

        it("fails when enter invalid amount", async function () {
            await expect(
                dexToken.connect(user).swapEtherToToken(
                    toWei(11000),
                    { value: toWei(10) }
                )
            ).to.be.revertedWith("not enough input amount!")
        })

        it("fails when no liqidity", async function () {
            await dexToken.removeLiquidity(toWei(100))

            await expect(
                dexToken.swapEtherToToken(
                    toWei(1000),
                    { value: toWei(10) })
            ).to.be.revertedWith("no liquidity!")
        })

        it("allows zero swaps", async function () {
            await dexToken.connect(user)
                .swapEtherToToken(toWei(0), { value: toWei(0) })

            expect(await token.balanceOf(user.address))
                .to.eq(0)

            expect(fromWei(await getBalance(dexToken.address)))
                .to.eq("100.0")

            expect(fromWei(await dexToken.getTokenBalance()))
                .to.eq("100000.0")
        })
    })

    describe("swapTokenToEther", function () {
        beforeEach(async function () {
            await token.transfer(user.address, toWei(10000))
            await token.connect(user)
                .approve(dexToken.address, toWei(10000))

            await token.approve(dexToken.address, toWei(100000))
            await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })
        })

        it("swaps correctly", async function () {
            expect(fromWei(await token.balanceOf(user.address)))
                .to.eq("10000.0")

            const txSwap = await dexToken.connect(user)
                .swapTokenToEther(toWei(10000), toWei(9))

            await expect(() => txSwap)
                .to.changeTokenBalances(
                    token,
                    [user.address, dexToken.address],
                    [toWei(-10000), toWei(10000)]
                )

            await expect(() => txSwap)
                .to.changeEtherBalances(
                    [user.address, dexToken.address],
                    [toWei("9.066108938801491315"),
                    toWei("-9.066108938801491315")]
                )

            expect(await token.balanceOf(user.address))
                .to.eq(0)

            expect(fromWei(await getBalance(dexToken.address)))
                .to.eq("90.933891061198508685")

            expect(fromWei(await dexToken.getTokenBalance()))
                .to.eq("110000.0")
        })

        it("fails when enter invalid amount", async function () {
            await expect(
                dexToken.connect(user)
                    .swapTokenToEther(toWei(10000), toWei(11))
            ).to.be.revertedWith("not enough input amount!")
        })

        it("fails when tokens are not approved", async function () {
            await expect(
                dexToken.swapTokenToEther(
                    toWei(1000), 
                    toWei(0.9)
                )
            ).to.be.revertedWith("ERC20: insufficient allowance")
        })

        it("fails when not enough funds", async function () {
            await token.approve(dexToken.address, toWei(10000000))

            await expect(
                dexToken.swapTokenToEther(
                    toWei(10000000), 
                    toWei(90)
                )
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance")
        })

        it("fails when no liqidity", async function () {
            await dexToken.removeLiquidity(toWei(100))
            await token.approve(dexToken.address, toWei(1000))

            await expect(
                dexToken.swapTokenToEther(
                    toWei(1000), 
                    toWei(0.9)
                )
            ).to.be.revertedWith("no liquidity!")
        })

        it("allows zero swaps", async function () {
            await dexToken.connect(user)
                .swapTokenToEther(toWei(0), toWei(0))

            expect(fromWei(await token.balanceOf(user.address)))
                .to.eq("10000.0")

            expect(fromWei(await getBalance(dexToken.address)))
                .to.eq("100.0")

            expect(fromWei(await dexToken.getTokenBalance()))
                .to.eq("100000.0")
        })

    })

    describe("swapTokenToToken", function () {
        beforeEach(async function () {
            await token.approve(dexToken.address, toWei(100000))
            await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })

            await ethers.provider.send("evm_increaseTime", [dayInSeconds * 1000])

            await dexToken.withdrawStakedTokens()
            await factory.transfer(user.address, toWei(100000))

            await factory.connect(user).approve(
                dexINT.address,
                toWei(50000)
            )
            await dexINT.connect(user).addLiquidity(
                toWei(50000),
                { value: toWei(100) }
            )
        })

        it("swaps correctly", async function () {
            await token.approve(dexToken.address, toWei(200))

            const txTtoT = dexToken.swapTokenToToken(
                toWei(200),
                toWei(99),
                factory.address
            )

            await expect(() => txTtoT)
                .to.changeTokenBalances(
                    factory,
                    [owner.address, dexINT.address],
                    [toWei("99.006653722756217405"),
                    toWei("-99.006653722756217405")]
                )
        })

        it("swaps reversed correctly", async function () {
            await factory.connect(user).approve(dexINT.address, toWei(100))

            const txTtoT = dexINT.connect(user).swapTokenToToken(
                toWei(100),
                toWei(198),
                token.address
            )

            await expect(() => txTtoT)
                .to.changeTokenBalances(
                    token,
                    [user.address, dexToken.address],
                    [toWei("198.013307445512434811"),
                    toWei("-198.013307445512434811")]
                )
        })

        it("fails when enter the same exchange address", async function () {
            await token.approve(dexToken.address, toWei(100))

            await expect(
                dexToken.swapTokenToToken(
                    toWei(100),
                    toWei(99),
                    token.address
                )
            ).to.be.revertedWith("exchange doesn't exist!")
        })

        it("fails when enter invalid exchange address", async function () {
            await token.approve(dexToken.address, toWei(100))

            await expect(
                dexToken.swapTokenToToken(
                    toWei(100),
                    toWei(99),
                    "0x0000000000000000000000000000000001111111"
                )
            ).to.be.revertedWith("exchange doesn't exist!")
        })

        it("fails when enter 0 exchange address", async function () {
            await token.approve(dexToken.address, toWei(100))

            await expect(
                dexToken.swapTokenToToken(
                    toWei(100),
                    toWei(99),
                    "0x0000000000000000000000000000000000000000"
                )
            ).to.be.revertedWith("exchange doesn't exist!")
        })

        it("fails when enter invalid amount", async function () {
            await token.approve(dexToken.address, toWei(200))

            await expect(
                dexToken.swapTokenToToken(
                    toWei(200),
                    toWei(200),
                    factory.address
                )
            ).to.be.revertedWith("not enough input amount!")
        })

        it("fails when no liqidity", async function () {
            await token.approve(dexToken.address, toWei(200))
            await dexINT.connect(user).removeLiquidity(toWei(100))

            await expect(
                dexToken.swapTokenToToken(
                    toWei(200),
                    toWei(99),
                    factory.address
                )
            ).to.be.revertedWith("no liquidity!")
        })

        it("allows zero swaps", async function () {
            const txTtoT = dexToken.swapTokenToToken(
                toWei(0),
                toWei(0),
                factory.address
            )

            await expect(() => txTtoT)
                .to.changeTokenBalances(
                    factory,
                    [owner.address, dexINT.address],
                    [0, 0]
                )
        })
    })
    describe("staking INT", function () {
        beforeEach(async function () {
            await token.approve(dexToken.address, toWei(100000))
            await dexToken.addLiquidity(toWei(100000), { value: toWei(100) })
        })

        it("returns staked amount", async function () {
            await ethers.provider.send("evm_increaseTime", [dayInSeconds])
            await ethers.provider.send("evm_mine", [])

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100"))
        })

        it("withdraws staked amount", async function () {
            await ethers.provider.send("evm_increaseTime", [dayInSeconds])

            const txWithdrawStaked = dexToken.withdrawStakedTokens()

            await expect(() => txWithdrawStaked)
                .to.changeTokenBalance(
                    factory,
                    owner.address,
                    toWei("100")
                )

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(0)
        })

        it("fails when withdraw 0 staked amount", async function () {
            await expect(
                dexToken.connect(user).withdrawStakedTokens()
            ).to.be.revertedWith("0 INT to withdraw!")
        })

        it("stakes if gets LP lokens", async function () {
            let txTransfer = dexToken.transfer(user.address, toWei(100))

            await expect(() => txTransfer)
                .to.changeTokenBalances(
                    dexToken,
                    [owner.address, user.address],
                    [toWei(-100), toWei(100)]
                )
            await ethers.provider.send("evm_increaseTime", [dayInSeconds])
            await ethers.provider.send('evm_mine', [])

            expect(await dexToken.getStakedAmount(user.address))
                .to.eq(toWei("100"))

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("0.001157407407407407"))
        })

        it("saves amount if adds liquidity again", async function () {
            await ethers.provider.send("evm_increaseTime", [dayInSeconds])
            await ethers.provider.send("evm_mine", [])

            await token.approve(dexToken.address, toWei(50000))
            await dexToken.addLiquidity(toWei(50000), { value: toWei(50) })

            expect(await dexToken.totalSupply()).to.eq(toWei(150))

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100.002314814814814814"))
        })

        it("saves amount if removes liquidity", async function () {
            await ethers.provider.send("evm_increaseTime", [dayInSeconds])
            await ethers.provider.send("evm_mine", [])

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100"))

            await dexToken.removeLiquidity(toWei(100))

            expect(await dexToken.totalSupply()).to.eq(0)

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100.001157407407407407"))
        })

        it("saves amount if transfers LP tokens", async function () {
            await ethers.provider.send("evm_increaseTime", [dayInSeconds])
            await ethers.provider.send("evm_mine", [])

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100"))

            const txTransfer = dexToken.transfer(user.address, toWei(100))

            await expect(() => txTransfer)
                .to.changeTokenBalances(
                    dexToken,
                    [owner.address, user.address],
                    [toWei(-100), toWei(100)]
                )

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100.001157407407407407"))
        })

        it("saves amount if gets LP tokens", async function () {
            await ethers.provider.send("evm_increaseTime", [dayInSeconds])
            await ethers.provider.send("evm_mine", [])

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100"))

            let txTransfer = dexToken.transfer(user.address, toWei(100))

            await expect(() => txTransfer)
                .to.changeTokenBalances(
                    dexToken,
                    [owner.address, user.address],
                    [toWei(-100), toWei(100)]
                )

            txTransfer = dexToken.connect(user).transfer(owner.address, toWei(100))

            await expect(() => txTransfer)
                .to.changeTokenBalances(
                    dexToken,
                    [owner.address, user.address],
                    [toWei(100), toWei(-100)]
                )

            expect(await dexToken.getStakedAmount(user.address))
                .to.eq(toWei("0.001157407407407407"))

            expect(await dexToken.getStakedAmount(owner.address))
                .to.eq(toWei("100.001157407407407407"))
        })
    })
})