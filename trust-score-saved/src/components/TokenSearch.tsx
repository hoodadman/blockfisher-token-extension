import { useId, useState, type ClipboardEvent, type FormEvent } from 'react';
import { SUPPORTED_CHAINS, isTokenAddress } from '../api/lookup';
import './TokenSearch.css';

const CHAIN_LIST = new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(SUPPORTED_CHAINS.map((chain) => chain.name));

export interface TokenSearchProps {
  onSearch: (address: string) => void;
  error?: string;
}

export function TokenSearch({ onSearch, error }: TokenSearchProps) {
  const [value, setValue] = useState('');
  const inputId = useId();
  const messageId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = value.trim();
    if (address) onSearch(address);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const pasted = event.clipboardData.getData('text').trim();
    const replacesEverything = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    if (!replacesEverything || !isTokenAddress(pasted)) return;
    event.preventDefault();
    setValue(pasted);
    onSearch(pasted);
  }

  return (
    <form className="search" role="search" onSubmit={handleSubmit}>
      <label className="search__label" htmlFor={inputId}>
        Token address
      </label>
      <div className="search__row">
        <input
          id={inputId}
          className="search__input"
          type="text"
          value={value}
          placeholder="Paste a contract address"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          onChange={(event) => setValue(event.target.value)}
          onPaste={handlePaste}
        />
        <button className="search__button" type="submit">
          Check
        </button>
      </div>
      {error ? (
        <p id={messageId} className="search__error" role="alert">
          {error}
        </p>
      ) : (
        <p id={messageId} className="search__hint">
          You’ll find it on the token’s page, usually labelled ‘contract address’ or ‘CA’. Works for {CHAIN_LIST} tokens.
        </p>
      )}
    </form>
  );
}
