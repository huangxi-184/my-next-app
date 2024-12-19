"use client"

import { useState, useRef } from "react"
import { SubmitButton } from "./button"
import { download } from "./actions"
export default function Home() {
  const [url, setUrl] = useState("")
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className="p-2">
      <form
        action={async (formData) => {
          const { success, message } = await download(formData)
          if (success) {
            setUrl(message)
            formRef.current?.reset()
          }
        }}
        className="mb-2"
        ref={formRef}>
        <label htmlFor="url" className="block text-sm font-medium leading-6 text-gray-900">
          M3U8 URL:
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          className="block w-full rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 mb-2"
        />
        <SubmitButton />
      </form>
      {url ? (
        <a
          href={new URL(url, location.href).toString()}
          download
          className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
          开始下载 {url}
        </a>
      ) : null}
    </div>
  )
}
