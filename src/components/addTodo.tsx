"use client"

import { type ChangeEvent, type FC, useState } from "react"
import { Button } from "./ui/button"

interface Props {
  createTodo: (value: string) => void
}

const AddTodo: FC<Props> = ({ createTodo }) => {
  const [input, setInput] = useState("")

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleAdd = async () => {
    createTodo(input)
    setInput("")
  }

  return (
    <div className="w-full flex gap-1 mt-2">
      <input
        type="text"
        className="w-full px-2 py-1 border border-gray-200 rounded outline-none"
        onChange={handleInput}
        value={input}
      />
      <Button onClick={handleAdd} variant="secondary">
        Add
      </Button>
    </div>
  )
}

export default AddTodo
