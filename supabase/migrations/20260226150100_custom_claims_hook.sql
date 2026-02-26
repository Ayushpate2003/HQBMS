create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    claims jsonb;
    user_role public.users.role%type;
    user_hospital public.users.hospital_id%type;
  begin
    -- Check if the user is marked as admin/staff in the users table
    select role, hospital_id into user_role, user_hospital from public.users where id = (event->>'user_id')::uuid;

    claims := event->'claims';

    if user_role is not null then
      -- Set the role claim
      claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
      -- Set the hospital claim
      claims := jsonb_set(claims, '{hospital_id}', to_jsonb(user_hospital));
    else
      -- Default to patient role
      claims := jsonb_set(claims, '{user_role}', '"patient"');
    end if;

    -- Update the 'claims' object in the original event
    event := jsonb_set(event, '{claims}', claims);

    -- Return the modified or original event
    return event;
  end;
$$;
