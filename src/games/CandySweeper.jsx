import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import confetti from "canvas-confetti";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../constants_contract";
import { Link } from "react-router-dom";

const triggerConfetti = () => {
  confetti({
    particleCount: 100,
    startVelocity: 30,
    spread: 360,
    origin: { x: 0.5, y: 0.5 }, // Center of the screen
    ticks: 200,
  });
};

const generateBoard = () => {
  const totalSquares = 16;
  const board = Array(totalSquares)
    .fill()
    .map(() => ({
      content: "",
      isRevealed: false,
      isMine: false,
    }));

  // Place 3 mines
  let minesPlaced = 0;
  while (minesPlaced < 3) {
    const index = Math.floor(Math.random() * totalSquares);
    if (!board[index].isMine) {
      board[index].isMine = true;
      board[index].content = "bomb";
      minesPlaced++;
    }
  }

  // Place 4 candies
  let candiesPlaced = 0;
  while (candiesPlaced < 4) {
    const index = Math.floor(Math.random() * totalSquares);
    if (!board[index].isMine && board[index].content === "") {
      board[index].content = "candy";
      candiesPlaced++;
    }
  }

  // Fill remaining with empty
  board.forEach((square) => {
    if (square.content === "") {
      square.content = "empty";
    }
  });

  return board;
};

const CandyMineSweeper = ({ walletAddress }) => {
  const [board, setBoard] = useState(generateBoard());
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameStatus, setGameStatus] = useState("waiting");
  const [contract, setContract] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);

  useEffect(() => {
    const initializeContract = async () => {
      if (typeof window.ethereum !== "undefined" && walletAddress) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const network = await provider.getNetwork();

          if (network.chainId !== 5003) {
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x138B" }],
            });
          }

          const gameContract = new ethers.Contract(
            CONTRACT_ADDRESS,
            CONTRACT_ABI,
            signer
          );

          setContract(gameContract);
        } catch (error) {
          console.error("Failed to initialize contract", error);
        }
      }
    };

    initializeContract();
  }, [walletAddress]);

  const startGame = async () => {
    try {
      if (!contract) return;

      const entryFee = ethers.parseEther("0.01");

      await contract.enterGame(entryFee, { value: entryFee });
      alert("Entry fee paid. Starting the game!");

      // Reset game state
      setBoard(generateBoard());
      setRevealedCount(0);
      setGameStatus("playing");
      setTimeLeft(30);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGameStatus("lost");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Error paying entry fee:", error);
    }
  };

  const handleSquareClick = (index) => {
    if (gameStatus !== "playing" || board[index].isRevealed) return;

    const newBoard = [...board];
    newBoard[index].isRevealed = true;

    // Check game conditions
    if (newBoard[index].content === "bomb") {
      clearInterval(timerRef.current);
      setGameStatus("lost");
    } else {
      const newRevealedCount = newBoard.filter(
        (square) => square.isRevealed
      ).length;
      setRevealedCount(newRevealedCount);

      // Win condition: 8 squares revealed without hitting a bomb
      if (newRevealedCount >= 8) {
        clearInterval(timerRef.current);
        handleWin();
      }
    }

    setBoard(newBoard);
  };

  const handleWin = async () => {
    try {
      if (!contract) return;

      setGameStatus("won");

      // Define the prize amount
      triggerConfetti();
      const prizeAmount = ethers.parseEther("0.02");

      // Pay the winner
      const payTx = await contract.payWinner(walletAddress, prizeAmount);
      await payTx.wait();
      alert("Congratulations! Prize Transferred!");

      // If won quickly (within half the time), mint an additional NFT
      // if (timeLeft > 15) {
      //   const mintTx = await contract.mintWinningNFT(1);
      //   await mintTx.wait();
      //   alert("You won quickly! Special NFT minted!");
      // }
    } catch (error) {
      console.error("Error during win processing:", error);
    }
  };

  const resetGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setBoard(generateBoard());
    setRevealedCount(0);
    setGameStatus("waiting");
    setTimeLeft(30);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white text-black font-sans">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-4">
          Candy MineSweeper
        </h1>

        {!contract ? (
          <div className="text-red-500 font-bold text-center">
            Please connect wallet through Navbar
          </div>
        ) : gameStatus === "waiting" ? (
           <>
            <div className="bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200 mb-4">
              <h2 className="text-xl font-semibold mb-4">Game Details</h2>
              <div className="space-y-3 text-gray-600">
                <p>🎮 Entry Fee: 0.01 MNT</p>
                <p>🏆 Potential Prize: 0.02 MNT</p>
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 hover:scale-105 duration-500 transition-all"
            >
              Pay Entry Fee & Start Game
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 text-2xl font-bold text-center">
              Time Left:
              <span
                className={`ml-2 ${
                  timeLeft <= 10 ? "text-red-500" : "text-green-500"
                }`}
              >
                {timeLeft} seconds
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {board.map((square, index) => (
                <button
                  key={index}
                  onClick={() => handleSquareClick(index)}
                  className={`
                    w-full aspect-square border-2 rounded-lg
                    transition-all duration-200 ease-in-out
                    flex items-center justify-center
                    ${
                      !square.isRevealed
                        ? "bg-gray-200 hover:bg-gray-300"
                        : square.content === "bomb"
                        ? "bg-red-500 text-white"
                        : square.content === "candy"
                        ? "bg-pink-300 text-white"
                        : "bg-green-200"
                    }
                    text-3xl font-bold
                  `}
                  disabled={square.isRevealed || gameStatus !== "playing"}
                >
                  {square.isRevealed
                    ? square.content === "bomb"
                      ? "💣"
                      : square.content === "candy"
                      ? "🍬"
                      : "✨"
                    : ""}
                </button>
              ))}
            </div>

            {gameStatus === "lost" && (
              <div className="text-center text-red-600 mb-4">
                <p className="text-xl font-bold">Game Over!</p>
                <p>Time's up or you hit a bomb. Better luck next time!</p>
                <Link to = '/games' ><button className="rounded bg-black p-2 m-2 font-semibold text-white">Play Again</button></Link>
              </div>
            )}

            {gameStatus === "won" && (
              <div className="text-center text-green-600 mb-4">
                <p className="text-xl font-bold">Congratulations!</p>
                <p>You successfully avoided the bombs and won a prize!</p>
              </div>
            )}
          </>
        )}

        {/* <div className="text-center mt-4">
          <button
            onClick={resetGame}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Reset Game
          </button>
        </div> */}

        <div className="mt-4 text-center text-gray-600 text-sm">
          <p>Rules: Pay entry fee, reveal 8 squares without hitting a bomb!</p>
          <p>Win fast to earn a special NFT bonus!</p>
        </div>
      </div>
    </div>
  );
};

export default CandyMineSweeper;
