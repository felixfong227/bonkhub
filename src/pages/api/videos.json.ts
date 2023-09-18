import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import ytsr from 'ytsr';

const continuationSchema = z.array(
    z.union([
        z.string(),
        z.object({
            client: z.object({
                utcOffsetMinutes: z.number(),
                gl: z.string(),
                hl: z.string(),
                clientName: z.string(),
                clientVersion: z.string()
            }),
            user: z.object({}),
            request: z.object({})
        }),
        z.object({
            limit: z.null().optional(),
            safeSearch: z.boolean(),
            pages: z.number(),
            requestOptions: z.object({ method: z.string() }),
            query: z.object({
                gl: z.string(),
                hl: z.string(),
                search_query: z.string()
            }),
            search: z.string()
        })
    ])
)

function isValidBase64(str: string) {
    try {
        return btoa(atob(str)) == str;
    } catch (err) {
        return false;
    }
}

function isBase64JSONLike(str: string, ctx: z.RefinementCtx) {
    try {
        const decoded = atob(str);
        JSON.parse(decoded);
        return true;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'UNKNOW';
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['continuation'],
            fatal: true,
            message: `Decoded value is not a valid JSON object, whyyyyyyyyyyyyyyyyy????????? *BONK* \n ${errMsg}`,
        })
        return false;
    }
}

function parseStrToObject(str: string) {
    return JSON.parse(str);
}

function continuationValidation(val: object, ctx: z.RefinementCtx) {
    const result = continuationSchema.safeParse(val);
    if (!result.success) {
        result.error.issues.forEach(issue => ctx.addIssue(issue));
    }
    return true;
}

const querySchema = z.object({
    continuation: z.string()
        .refine(isValidBase64, 'input is not a valid Base64 string *BONK*')
        .superRefine(isBase64JSONLike)
        .transform(atob)
        .transform(parseStrToObject)
        .superRefine(continuationValidation)
        // // .refine(val => continuationSchema.safeParse(val).success, 'The continuation schema is not valid, whyyyyyyyyyyy?????????????????? *BONK*')
        // .refine(continuationValidation)
        // .transform(val => continuationSchema.safeParse(val))
        // .optional()
});

export const GET: APIRoute = async ({ request }) => {

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const queryParams = querySchema.safeParse(params);

    if (!queryParams.success) {
        return new Response(
            JSON.stringify({
                message: `Validation failed`,
                zodIssues: queryParams.error.issues,
            }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    try {

        const searchResults = await ytsr('BONK meme', {
            limit: 10,
            pages: 1,
        });

        return new Response(
            JSON.stringify({
                data: searchResults.items,
                metadata: {
                    continuation: searchResults.continuation !== null ? btoa(JSON.stringify(searchResults.continuation)) : null,
                }
            }),
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

    } catch (err) {
        return new Response(
            JSON.stringify({
                message: 'Internal server error',
                details: {
                    error: err instanceof Error ? err.message : 'Unknow error',
                }
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }

}